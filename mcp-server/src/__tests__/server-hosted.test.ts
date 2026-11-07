import { describe, expect, it, vi } from 'vitest';
import { handleMcpHttpRequest, type WorkingSessionSnapshot, type WorkingSessionStore } from '../server.js';

const API = 'https://archdraw.test';
const MERMAID = 'graph LR\n  Web[Web App] --> API[API]';
const previewBody = {
  nodes: [
    { id: 'Web', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'Web App' } },
    { id: 'API', type: 'shapeNode', position: { x: 300, y: 0 }, data: { label: 'API' } },
  ],
  edges: [{ id: 'e1', source: 'Web', target: 'API' }],
  warnings: [],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function memoryStore(): WorkingSessionStore & { data: Map<string, WorkingSessionSnapshot> } {
  const data = new Map<string, WorkingSessionSnapshot>();
  return {
    data,
    load: async (id) => (data.has(id) ? JSON.parse(JSON.stringify(data.get(id))) : null),
    save: async (id, snapshot) => { data.set(id, JSON.parse(JSON.stringify(snapshot))); },
  };
}

let rpcId = 0;
async function callTool(store: WorkingSessionStore, fetchImpl: typeof fetch, name: string, args: Record<string, unknown>) {
  const request = new Request('https://archdraw.test/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
  });
  const response = await handleMcpHttpRequest(request, { sessionStore: store, context: { apiBase: API, fetch: fetchImpl } });
  const body = await response.json() as { result: { content: Array<{ text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean } };
  return body.result;
}

describe('hosted (stateless HTTP) mode', () => {
  it('persists the working session between requests and routes fetches through the request context', async () => {
    const store = memoryStore();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(previewBody))
      .mockResolvedValueOnce(json({ sessionId: 's1', updateToken: 't1' }));

    const generated = await callTool(store, fetchImpl, 'generate_diagram', { mermaid: MERMAID });
    expect(generated.isError).toBeFalsy();
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`${API}/api/diagram/load`);
    const workingSessionId = generated.structuredContent?.workingSessionId as string;
    expect(workingSessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.data.get(workingSessionId)?.diagram?.nodes).toHaveLength(2);

    // A later request (possibly another instance) sees the saved diagram.
    const state = await callTool(store, vi.fn(), 'get_diagram_state', { workingSessionId });
    const parsed = JSON.parse(state.content[0].text);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.updateToken).toBeUndefined();
  });

  it('refuses stateful calls without a workingSessionId instead of sharing a default session', async () => {
    const result = await callTool(memoryStore(), vi.fn(), 'update_diagram', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/workingSessionId/);
  });

  it('rejects a workingSessionId that is not a UUID', async () => {
    const result = await callTool(memoryStore(), vi.fn(), 'get_diagram_state', { workingSessionId: 'default' });
    expect(result.isError).toBe(true);
  });

  describe('draw_on_canvas', () => {
    it('is listed with a schema an agent can follow', async () => {
      const request = new Request('https://archdraw.test/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list' }),
      });
      const response = await handleMcpHttpRequest(request, { sessionStore: memoryStore(), context: { apiBase: API, fetch: vi.fn() } });
      const body = await response.json() as { result: { tools: Array<{ name: string; description: string; inputSchema: { required: string[]; properties: { ops: { items: { properties: { op: { enum: string[] } } } } } } }> } };
      const tool = body.result.tools.find(t => t.name === 'draw_on_canvas')!;
      expect(tool).toBeDefined();
      expect(tool.inputSchema.required).toEqual(['ops']);
      expect(tool.inputSchema.properties.ops.items.properties.op.enum).toEqual(expect.arrayContaining(['text', 'card', 'note', 'group', 'connect', 'move', 'align', 'distribute', 'remove', 'clear']));
      expect(tool.description).toMatch(/ALL of them apply or NONE do/);
    });

    it('starts a canvas with no session id, then edits it by the id it returned', async () => {
      const store = memoryStore();
      const fetchImpl = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(json({ sessionId: 'd1', updateToken: 'dt1', revision: 1, previewSvg: '<svg/>' }))
        .mockResolvedValueOnce(json({ sessionId: 'd1', revision: 2 }))
        .mockResolvedValueOnce(json({ previewSvg: '<svg/>' }));

      const first = await callTool(store, fetchImpl, 'draw_on_canvas', { ops: [{ op: 'card', id: 'c1', x: 10, y: 20 }] });
      expect(first.isError).toBeFalsy();
      expect(first.content[0].text).toContain('https://archdraw.test/share/d1');
      const workingSessionId = first.structuredContent?.workingSessionId as string;
      expect(workingSessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(store.data.get(workingSessionId)?.diagram?.nodes).toHaveLength(1);

      const second = await callTool(store, fetchImpl, 'draw_on_canvas', { workingSessionId, ops: [{ op: 'update', id: 'c1', title: 'Written in' }, { op: 'text', text: 'note', x: 10, y: 200 }] });
      expect(second.isError).toBeFalsy();
      expect(store.data.get(workingSessionId)?.diagram?.nodes).toHaveLength(2);
      expect(second.structuredContent?.canvas).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'c1', text: 'Written in' })]));
    });

    it('returns a usable error for a bad operation and for a missing id on an edit', async () => {
      const bad = await callTool(memoryStore(), vi.fn(), 'draw_on_canvas', { ops: [{ op: 'connect', from: 'a', to: 'b' }] });
      expect(bad.isError).toBe(true);
      expect(bad.content[0].text).toMatch(/Operation 1 \(connect\)/);
    });
  });
});

describe('server identity', () => {
  it('tells clients its title, site and brand icons on initialize', async () => {
    const request = new Request('https://archdraw.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++rpcId,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      }),
    });
    const response = await handleMcpHttpRequest(request, { sessionStore: memoryStore(), context: { apiBase: API, fetch: vi.fn() } });
    const body = await response.json() as { result: { serverInfo: { title?: string; websiteUrl?: string; icons?: Array<{ src: string; sizes?: string[] }> } } };
    const info = body.result.serverInfo;
    expect(info.title).toBe('ArchDraw');
    expect(info.websiteUrl).toBe('https://archdraw.hiabhee.online');
    expect(info.icons?.map((i) => i.src)).toContain('https://archdraw.hiabhee.online/logo.png');
    expect(info.icons?.every((i) => i.src.startsWith('https://'))).toBe(true);
  });
});
