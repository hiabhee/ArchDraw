import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/index.js';

function makeNode(id: string, overrides: Partial<ReactFlowNode> = {}): ReactFlowNode {
  return {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    data: { label: id, icon: 'box', layer: 'compute', tier: 'compute', tierColor: '#0d9488' },
    width: 200,
    height: 70,
    ...overrides,
  };
}

function makeEdge(id: string, source: string, target: string): ReactFlowEdge {
  return {
    id,
    source,
    target,
    type: 'simpleFloating',
    animated: false,
    label: '',
    labelShowBg: true,
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#1e1e2e' },
    labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
    style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '' },
    markerEnd: { type: 'arrowclosed', color: '#94a3b8' },
    data: { communicationType: 'sync', pathType: 'smooth', label: '' },
  };
}

describe('diagram-state', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty state before anything is set', async () => {
    const { getDiagramState } = await import('../diagram-state.js');
    const state = getDiagramState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.sessionId).toBeUndefined();
  });

  it('stores and returns nodes/edges and sessionId', async () => {
    const { setDiagramState, getDiagramState } = await import('../diagram-state.js');
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];
    setDiagramState({ nodes, edges, sessionId: 'sess-123' });

    const state = getDiagramState();
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);
    expect(state.sessionId).toBe('sess-123');
    // returned copies must not mutate the store
    state.nodes.push(makeNode('c'));
    expect(getDiagramState().nodes).toHaveLength(2);
  });

  it('sets sessionId independently without losing nodes', async () => {
    const { setDiagramState, setDiagramSessionId, getDiagramState } = await import('../diagram-state.js');
    setDiagramState({ nodes: [makeNode('a')], edges: [] });
    setDiagramSessionId('sess-456');
    expect(getDiagramState().sessionId).toBe('sess-456');
    expect(getDiagramState().nodes).toHaveLength(1);
  });

  it('ignores falsy session ids', async () => {
    const { setDiagramState, setDiagramSessionId, getDiagramState } = await import('../diagram-state.js');
    setDiagramState({ nodes: [makeNode('a')], edges: [] });
    setDiagramSessionId(undefined);
    expect(getDiagramState().sessionId).toBeUndefined();
  });

  it('hasDiagramState reflects whether state was set', async () => {
    const { setDiagramState, hasDiagramState } = await import('../diagram-state.js');
    expect(hasDiagramState()).toBe(false);
    setDiagramState({ nodes: [makeNode('a')], edges: [] });
    expect(hasDiagramState()).toBe(true);
  });
});
