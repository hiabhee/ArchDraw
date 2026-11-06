import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutDiagram } from '../layout-diagram.js';
import { clearDiagramState, getDiagramState, setDiagramState } from '../../lib/diagram-state.js';
import { runWithMcpContext } from '../../lib/http.js';
import { LayoutDiagramInputSchema } from '../../lib/schema.js';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/index.js';

const WS = 'layout-test';
const input = (value: unknown = {}) => LayoutDiagramInputSchema.parse(value);

const node = (id: string, x: number, y: number, type = 'shapeNode'): ReactFlowNode =>
  ({ id, type, position: { x, y }, width: 200, height: 90, data: { label: id } }) as unknown as ReactFlowNode;
const edge = (id: string, source: string, target: string): ReactFlowEdge => ({ id, source, target }) as unknown as ReactFlowEdge;

/** A fake ArchDraw API that lays everything out in a column and records what it was asked. */
function api(options: { layoutStatus?: number } = {}) {
  const calls: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>;
    calls.push(body);
    if (body.layout) {
      const status = options.layoutStatus ?? 200;
      return {
        ok: status === 200, status,
        json: async () => status === 200
          ? { nodes: body.nodes.map((n: ReactFlowNode, i: number) => ({ ...n, position: { x: 0, y: i * 150 } })), edges: body.edges, warnings: [] }
          : { error: 'The layout could not be computed for this diagram.' },
      } as Response;
    }
    if (body.action === 'mcp-update') return { ok: true, status: 200, json: async () => ({ sessionId: body.sessionId, revision: Number(body.expectedRevision) + 1 }) } as Response;
    if (body.dryRun) return { ok: true, status: 200, json: async () => ({ previewSvg: '<svg/>' }) } as Response;
    return { ok: true, status: 200, json: async () => ({ sessionId: 'sess1', updateToken: 'tok1', revision: 1 }) } as Response;
  });
  const run = <T>(fn: () => Promise<T>) => runWithMcpContext({ apiBase: 'https://archdraw.test', fetch: fetchMock as unknown as typeof fetch }, fn);
  return { calls, run };
}

describe('layoutDiagram', () => {
  beforeEach(() => clearDiagramState(WS));
  afterEach(() => clearDiagramState(WS));

  it('asks ArchDraw to lay the current diagram out and returns the new positions', async () => {
    setDiagramState({ nodes: [node('a', 0, 0), node('b', 400, 0)], edges: [edge('e', 'a', 'b')] }, WS);
    const { calls, run } = api();
    const result = await run(() => layoutDiagram(input({ direction: 'TD', arrangement: 'zones', fold: false, mixDirections: false }), WS));
    expect(result.success).toBe(true);
    const request = calls.find(call => call.layout)!;
    expect(request.dryRun).toBe(true);
    expect(request.layout).toMatchObject({ direction: 'TD', style: 'zones', foldLongFlows: false, mixGroupDirections: false });
    expect(result.canvas.map(entry => entry.y)).toEqual([0, 150]);
    expect(result.edges).toHaveLength(1);
  });

  it('sets the direction of the groups it is told to, and only those', async () => {
    setDiagramState({ nodes: [node('api', 0, 0, 'groupNode'), node('data', 300, 0, 'groupNode'), node('a', 10, 10)], edges: [] }, WS);
    const { calls, run } = api();
    await run(() => layoutDiagram(input({ groupDirections: { api: 'TD' } }), WS));
    const sent = (calls.find(call => call.layout)!.nodes as ReactFlowNode[]);
    expect(sent.find(n => n.id === 'api')!.data).toMatchObject({ direction: 'TD' });
    expect((sent.find(n => n.id === 'data')!.data as Record<string, unknown>).direction).toBeUndefined();
  });

  it('refuses unknown group ids and an empty canvas without calling the API', async () => {
    const { calls, run } = api();
    const empty = await run(() => layoutDiagram(input(), WS));
    expect(empty.success).toBe(false);
    setDiagramState({ nodes: [node('a', 0, 0)], edges: [] }, WS);
    const unknown = await run(() => layoutDiagram(input({ groupDirections: { nope: 'LR' } }), WS));
    expect(unknown.success).toBe(false);
    expect(unknown.error).toContain('nope');
    expect(calls).toHaveLength(0);
  });

  it('leaves the diagram untouched when the layout fails', async () => {
    setDiagramState({ nodes: [node('a', 5, 7)], edges: [] }, WS);
    const { run } = api({ layoutStatus: 422 });
    const result = await run(() => layoutDiagram(input(), WS));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nothing was changed');
    expect(getDiagramState(WS).nodes[0].position).toEqual({ x: 5, y: 7 });
  });

  it('updates a published diagram in place with its token and revision', async () => {
    setDiagramState({ nodes: [node('a', 0, 0), node('b', 300, 0)], edges: [], sessionId: 'sess1', updateToken: 'tok1', revision: 3 }, WS);
    const { calls, run } = api();
    const result = await run(() => layoutDiagram(input(), WS));
    const update = calls.find(call => call.action === 'mcp-update')!;
    expect(update).toMatchObject({ sessionId: 'sess1', updateToken: 'tok1', expectedRevision: 3 });
    expect(result.revision).toBe(4);
  });
});
