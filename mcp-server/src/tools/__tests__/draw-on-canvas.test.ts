import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawOnCanvas } from '../draw-on-canvas.js';
import { clearDiagramState, getDiagramState, setDiagramState } from '../../lib/diagram-state.js';
import { runWithMcpContext } from '../../lib/http.js';
import { DrawOnCanvasInputSchema } from '../../lib/schema.js';
import type { ReactFlowNode } from '../../types/index.js';

const WS = 'draw-test';
const input = (value: unknown) => DrawOnCanvasInputSchema.parse(value);

/** A fake ArchDraw API: records the calls, answers create / update / preview. */
function api(options: { updateStatus?: number } = {}) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ url, body });
    if (body.action === 'mcp-update') {
      const status = options.updateStatus ?? 200;
      return { ok: status === 200, status, json: async () => ({ sessionId: body.sessionId, revision: Number(body.expectedRevision) + 1 }) } as Response;
    }
    if (body.dryRun) return { ok: true, status: 200, json: async () => ({ previewSvg: '<svg/>' }) } as Response;
    return { ok: true, status: 200, json: async () => ({ sessionId: 'sess1', updateToken: 'tok1', revision: 1, previewSvg: '<svg/>' }) } as Response;
  });
  const run = <T>(fn: () => Promise<T>) => runWithMcpContext({ apiBase: 'https://archdraw.test', fetch: fetchMock as unknown as typeof fetch }, fn);
  return { calls, run };
}

describe('drawOnCanvas', () => {
  beforeEach(() => clearDiagramState(WS));
  afterEach(() => clearDiagramState(WS));

  it('draws on a blank canvas and publishes it, with exact positions and a link', async () => {
    const { calls, run } = api();
    const result = await run(() => drawOnCanvas(input({
      label: 'Whiteboard',
      ops: [
        { op: 'text', id: 'title', text: 'Plan', x: 40, y: 20, size: 'heading' },
        { op: 'card', id: 'todo', x: 40, y: 200 },
        { op: 'note', id: 'n', x: 400, y: 200, title: 'Later', body: 'maybe' },
        { op: 'connect', from: 'todo', to: 'n', label: 'then' },
      ],
    }), WS));

    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(1);
    expect(result.shareUrl).toBe('https://archdraw.test/share/sess1');
    expect(result.updateToken).toBe('tok1');
    expect(result.previewSvg).toBe('<svg/>');
    // The nodes are sent as drawn: positions are not re-laid out.
    const create = calls.find(c => c.body.source === 'mcp')!;
    expect(create.body).toMatchObject({ publish: true, label: 'Whiteboard' });
    expect((create.body.nodes as Array<{ id: string; position: unknown }>).find(n => n.id === 'title')!.position).toEqual({ x: 40, y: 20 });
    // The reply maps every node so the next drawing can be placed.
    expect(result.canvas.find(e => e.id === 'todo')).toMatchObject({ x: 40, y: 200 });
    expect(result.bounds!.x).toBe(40);
  });

  it('draws hand-drawn by default and returns the shareable image links', async () => {
    const { calls, run } = api();
    const sketch = await run(() => drawOnCanvas(input({ ops: [{ op: 'card', x: 0, y: 0 }] }), WS));
    expect(calls.find(c => c.body.source === 'mcp')!.body.previewStyle).toBe('sketch');
    const { imageUrlsFor } = await import('../../lib/preview-links.js');
    expect(imageUrlsFor(sketch.shareUrl)!.png).toBe('https://archdraw.test/api/diagram/image/sess1?style=sketch&format=png');
    clearDiagramState(WS);
    const clean = await run(() => drawOnCanvas(input({ style: 'studio', ops: [{ op: 'card', x: 0, y: 0 }] }), WS));
    expect(calls.filter(c => c.body.source === 'mcp')[1].body.previewStyle).toBe('studio');
    expect(clean.success).toBe(true);
  });

  it('updates a published canvas in place, from the revision it holds', async () => {
    const { calls, run } = api();
    const first = await run(() => drawOnCanvas(input({ ops: [{ op: 'text', id: 'a', text: 'one', x: 0, y: 0 }] }), WS));
    setDiagramState({ nodes: first.nodes as unknown as ReactFlowNode[], edges: [], sessionId: first.sessionId, updateToken: first.updateToken, revision: first.revision }, WS);
    const second = await run(() => drawOnCanvas(input({ ops: [{ op: 'text', id: 'b', text: 'two', x: 0, y: 200 }] }), WS));

    const update = calls.find(c => c.body.action === 'mcp-update')!;
    expect(update.body).toMatchObject({ sessionId: 'sess1', updateToken: 'tok1', expectedRevision: 1 });
    expect((update.body.nodes as unknown[]).length).toBe(2);
    expect(second.revision).toBe(2);
    expect(second.nodes.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('keeps the drawing in this session when publish is false, and sends nothing to publish', async () => {
    const { calls, run } = api();
    const result = await run(() => drawOnCanvas(input({ publish: false, ops: [{ op: 'card', x: 0, y: 0 }] }), WS));
    expect(result.success).toBe(true);
    expect(result.shareUrl).toBeUndefined();
    expect(calls.some(c => c.body.source === 'mcp')).toBe(false);
  });

  it('works with no API at all (local only)', async () => {
    const result = await drawOnCanvas(input({ ops: [{ op: 'card', x: 0, y: 0 }] }), WS);
    expect(result.success).toBe(true);
    expect(result.shareUrl).toBeUndefined();
    expect(result.nodes).toHaveLength(1);
  });

  it('changes nothing and says which operation failed', async () => {
    const { calls, run } = api();
    const result = await run(() => drawOnCanvas(input({ ops: [{ op: 'card', id: 'a', x: 0, y: 0 }, { op: 'connect', from: 'a', to: 'ghost' }] }), WS));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Operation 2 \(connect\)/);
    expect(result.failedOperation).toBe(1);
    expect(calls).toHaveLength(0);
    expect(getDiagramState(WS).nodes).toHaveLength(0);
  });

  it('reports a revision conflict without losing the local canvas', async () => {
    const { run } = api({ updateStatus: 409 });
    setDiagramState({ nodes: [{ id: 'a', type: 'textLabelNode', position: { x: 0, y: 0 }, data: { text: 'one' } } as unknown as ReactFlowNode], edges: [], sessionId: 'sess1', updateToken: 'tok1', revision: 3 }, WS);
    const result = await run(() => drawOnCanvas(input({ ops: [{ op: 'text', text: 'two', x: 0, y: 100 }] }), WS));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/changed elsewhere/);
    expect(getDiagramState(WS).nodes).toHaveLength(1);
  });

  it('starts a new published canvas after clear instead of overwriting the old one', async () => {
    const { calls, run } = api();
    setDiagramState({ nodes: [{ id: 'old', type: 'textLabelNode', position: { x: 0, y: 0 }, data: { text: 'old' } } as unknown as ReactFlowNode], edges: [], sessionId: 'oldsess', updateToken: 'oldtok', revision: 4 }, WS);
    const result = await run(() => drawOnCanvas(input({ ops: [{ op: 'clear' }, { op: 'text', text: 'fresh', x: 0, y: 0 }] }), WS));
    expect(result.success).toBe(true);
    expect(calls.some(c => c.body.action === 'mcp-update')).toBe(false);
    expect(result.sessionId).toBe('sess1');
    expect(result.nodes.map(n => n.id)).toEqual(['text_1']);
  });

  it('rejects a group inside a group (the editor does not nest them)', async () => {
    const result = await drawOnCanvas(input({ ops: [
      { op: 'card', id: 'a', x: 0, y: 0 },
      { op: 'group', id: 'inner', children: ['a'] },
      { op: 'group', id: 'outer', children: ['inner'] },
    ] }), WS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot also be a child/);
  });

  it('reports layout problems in the result so the agent can fix them', async () => {
    const { run } = api();
    const result = await run(() => drawOnCanvas(input({
      publish: false,
      ops: [
        { op: 'clear' },
        { op: 'card', id: 'chat', x: 0, y: 0, title: 'Chat Servers' },
        { op: 'card', id: 'router', x: 230, y: 0, title: 'Message Router' },
        { op: 'connect', from: 'chat', to: 'router', label: 'encrypted msg' },
        { op: 'card', id: 'store', x: 230, y: 30, title: 'Message Store' },
      ],
    }), WS));
    expect(result.success).toBe(true);
    const kinds = (result.issues ?? []).map(issue => issue.kind);
    expect(kinds).toContain('overlap');
    expect(kinds).toContain('label-gap');
  });

  it('reports no problems for a tidy drawing', async () => {
    const { run } = api();
    const result = await run(() => drawOnCanvas(input({
      publish: false,
      ops: [
        { op: 'clear' },
        { op: 'card', id: 'a', x: 0, y: 0, title: 'A' },
        { op: 'card', id: 'b', x: 500, y: 0, title: 'B' },
        { op: 'connect', from: 'a', to: 'b', label: 'call' },
      ],
    }), WS));
    expect(result.issues ?? []).toEqual([]);
  });
});
