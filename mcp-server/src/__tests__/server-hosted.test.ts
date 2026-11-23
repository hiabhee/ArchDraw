import { describe, expect, it, vi } from 'vitest';
import { handleMcpHttpRequest, type WorkingSessionSnapshot, type WorkingSessionStore } from '../server.js';
import { DIAGRAM_WIDGET_URI, PREVIEW_CANVAS_META_KEY, PREVIEW_SVG_META_KEY } from '../ui/diagram-widget.js';

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
  const body = await response.json() as { result: { content: Array<{ text: string }>; structuredContent?: Record<string, unknown>; _meta?: Record<string, unknown>; isError?: boolean } };
  return body.result;
}

describe('hosted (stateless HTTP) mode', () => {
  it('advertises template-style generation guidance to MCP clients', async () => {
    const request = new Request(`${API}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list' }),
    });
    const response = await handleMcpHttpRequest(request, { sessionStore: memoryStore(), context: { apiBase: API } });
    const body = await response.json() as { result: { tools: Array<{ name: string; description: string }> } };
    const generate = body.result.tools.find(tool => tool.name === 'generate_diagram');

    expect(generate?.description).toContain('Plan the main flow first');
    expect(generate?.description).toContain('Show where branches rejoin');
    expect(generate?.description).toContain('Keep real return paths, feedback loops, and hub connections');
  });

  it('persists the working session between requests and routes fetches through the request context', async () => {
    const store = memoryStore();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(previewBody))
      .mockResolvedValueOnce(json({ sessionId: 's1', updateToken: 't1' }));

    const generated = await callTool(store, fetchImpl, 'generate_diagram', { mermaid: MERMAID });
    expect(generated.isError).toBeFalsy();
    expect(generated.content[0].text).toContain('/share/s1');
    expect(generated.content[0].text).toContain('/editor?session=s1');
    expect(generated.content[0].text).not.toContain('/api/diagram/image/');
    expect(generated._meta?.[PREVIEW_CANVAS_META_KEY]).toMatchObject({ nodes: previewBody.nodes, edges: previewBody.edges });
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

  it('uses the generated preview for publication and reports layout issues without another preview call', async () => {
    const previewQuality = {
      status: 'invalid', hardViolations: 1, crossings: 0, labelCollisions: 1,
      criticalPathDisconnectCount: 0, unexplainedPrivateOverlapLength: 0,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ...previewBody, previewQuality, previewSvg: '<svg/>' }))
      .mockResolvedValueOnce(json({ sessionId: 'result', updateToken: 'token' }));

    const result = await callTool(memoryStore(), fetchImpl, 'generate_diagram', {
      userPrompt: 'Draw a web API', mermaid: MERMAID, direction: 'DOWN',
    });

    expect(result.structuredContent?.previewQuality).toEqual(previewQuality);
    expect(result.content[0].text).toContain('1 label collisions');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      mermaid: expect.stringMatching(/^graph TD/), dryRun: true, layout: { autoDirection: false },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
      nodes: previewBody.nodes, edges: previewBody.edges, label: 'AI Diagram', source: 'mcp', publish: true,
    });
  });

  it('keeps the graph in the interactive canvas when the model requests a compact result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewBody));
    const result = await callTool(memoryStore(), fetchImpl, 'generate_diagram', {
      mermaid: MERMAID, publish: false, compactResponse: true,
    });
    expect(result.structuredContent).toMatchObject({ success: true, metadata: { nodeCount: 2, edgeCount: 1 } });
    expect(result.structuredContent).not.toHaveProperty('nodes');
    expect(result.structuredContent).not.toHaveProperty('edges');
    expect(result._meta?.[PREVIEW_CANVAS_META_KEY]).toMatchObject({ nodes: previewBody.nodes, edges: previewBody.edges });
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
    it('blocks unnamed cards at final preview and accepts their names after an edit', async () => {
      const store = memoryStore();
      const fetchImpl = vi.fn().mockResolvedValue(json({ previewSvg: '<svg/>' }));
      const drawn = await callTool(store, fetchImpl, 'draw_on_canvas', {
        publish: false, ops: [{ op: 'card', id: 'person', title: '   ', x: 0, y: 0 }],
      });
      const workingSessionId = drawn.structuredContent?.workingSessionId;
      const incomplete = await callTool(store, fetchImpl, 'show_diagram', { workingSessionId });
      expect(incomplete.isError).toBe(true);
      expect(incomplete.content[0].text).toMatch(/visible names: person/);
      expect(incomplete._meta?.[PREVIEW_CANVAS_META_KEY]).toBeUndefined();

      await callTool(store, fetchImpl, 'draw_on_canvas', {
        workingSessionId, publish: false, ops: [{ op: 'update', id: 'person', title: 'Olympias' }],
      });
      const finished = await callTool(store, fetchImpl, 'show_diagram', { workingSessionId });
      expect(finished.isError).toBeFalsy();
      expect(finished._meta?.[PREVIEW_CANVAS_META_KEY]).toMatchObject({
        nodes: [expect.objectContaining({ id: 'person', data: expect.objectContaining({ label: 'Olympias' }) })],
      });
    });

    it('is listed with a schema an agent can follow', async () => {
      const request = new Request('https://archdraw.test/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list' }),
      });
      const response = await handleMcpHttpRequest(request, { sessionStore: memoryStore(), context: { apiBase: API, fetch: vi.fn() } });
      const body = await response.json() as { result: { tools: Array<{ name: string; description: string; _meta?: { ui?: { resourceUri?: string } }; inputSchema: { required: string[]; properties: { ops: { items: { properties: { op: { enum: string[] } } } } } } }> } };
      const tool = body.result.tools.find(t => t.name === 'draw_on_canvas')!;
      expect(tool).toBeDefined();
      expect(tool.inputSchema.required).toEqual(['ops']);
      expect(tool.inputSchema.properties.ops.items.properties.op.enum).toEqual(expect.arrayContaining(['text', 'card', 'note', 'group', 'connect', 'move', 'align', 'distribute', 'remove', 'clear']));
      expect(tool.description).toMatch(/ALL of them apply or NONE do/);
      expect(body.result.tools.filter((item) => item._meta?.ui?.resourceUri === DIAGRAM_WIDGET_URI).map((item) => item.name))
        .toEqual(['generate_diagram', 'show_diagram']);
    });

    it('starts a canvas with no session id, then edits it by the id it returned', async () => {
      const store = memoryStore();
      const fetchImpl = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(json({ sessionId: 'd1', updateToken: 'dt1', revision: 1, previewNodeSizes: { c1: { width: 300, height: 114 } } }))
        .mockResolvedValueOnce(json({ sessionId: 'd1', revision: 2 }))
        .mockResolvedValueOnce(json({ previewSvg: '<svg/>' }));

      const first = await callTool(store, fetchImpl, 'draw_on_canvas', { ops: [{ op: 'card', id: 'c1', x: 10, y: 20 }] });
      expect(first.isError).toBeFalsy();
      expect(first.content[0].text).toContain('https://archdraw.test/share/d1');
      expect(first._meta).toBeUndefined();
      expect(first.structuredContent?.canvas).toEqual([expect.objectContaining({ id: 'c1', width: 300, height: 114 })]);
      const workingSessionId = first.structuredContent?.workingSessionId as string;
      expect(workingSessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(store.data.get(workingSessionId)?.diagram?.nodes).toHaveLength(1);

      const second = await callTool(store, fetchImpl, 'draw_on_canvas', { workingSessionId, ops: [{ op: 'update', id: 'c1', title: 'Written in' }, { op: 'text', text: 'note', x: 10, y: 200 }] });
      expect(second.isError).toBeFalsy();
      expect(store.data.get(workingSessionId)?.diagram?.nodes).toHaveLength(2);
      expect(second.structuredContent?.canvas).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'c1', text: 'Written in' })]));
      expect(second._meta).toBeUndefined();
      const preview = await callTool(store, vi.fn().mockResolvedValue(json({ previewSvg: '<svg/>' })), 'show_diagram', { workingSessionId });
      expect(preview._meta?.[PREVIEW_SVG_META_KEY]).toBe('<svg/>');
      expect(preview._meta?.[PREVIEW_CANVAS_META_KEY]).toEqual({
        nodes: [expect.objectContaining({ id: 'c1' }), expect.any(Object)],
        edges: [],
        style: 'studio',
      });
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
