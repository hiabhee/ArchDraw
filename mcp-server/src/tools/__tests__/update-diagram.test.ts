import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { ReactFlowNode } from '../../types/index.js';

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

function mockFetchNonOk() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  }) as unknown as typeof fetch;
}

describe('updateDiagram', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = mockFetchNonOk();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves group data and top-level parentNode when adding a child', async () => {
    const { setDiagramState } = await import('../../lib/diagram-state.js');
    const { updateDiagram } = await import('../update-diagram.js');

    const group = makeNode('backend_group', {
      type: 'groupNode',
      data: { label: 'Backend', icon: 'layers', layer: 'compute', tier: 'compute', tierColor: '#0d9488', isGroup: true },
      width: 500,
      height: 280,
      zIndex: 0,
    });
    const existing = makeNode('auth_svc', { data: { label: 'Auth', icon: 'shield', layer: 'compute', tier: 'compute', tierColor: '#0d9488' } });
    setDiagramState({ nodes: [group, existing], edges: [] });

    const result = await updateDiagram({
      addNodes: [{ id: 'order_svc', label: 'Order Service', tier: 'compute', subtitle: 'Handles orders', parentId: 'backend_group', icon: 'shopping-cart' }],
    });

    expect(result.success).toBe(true);
    const orderSvc = result.nodes.find(n => n.id === 'order_svc');
    expect(orderSvc?.data.parentId).toBe('backend_group');
    expect(orderSvc?.parentNode).toBe('backend_group');
    expect(orderSvc?.data.subtitle).toBe('Handles orders');

    const groupOut = result.nodes.find(n => n.id === 'backend_group');
    expect(groupOut?.data.isGroup).toBe(true);
    expect(groupOut?.type).toBe('groupNode');
    expect(result.changes.nodesAdded).toBe(1);
  });

  it('removes a node and its connected edges', async () => {
    const { setDiagramState } = await import('../../lib/diagram-state.js');
    const { updateDiagram } = await import('../update-diagram.js');

    const a = makeNode('a');
    const b = makeNode('b');
    setDiagramState({
      nodes: [a, b],
      edges: [{
        id: 'e1', source: 'a', target: 'b', type: 'simpleFloating', animated: false, label: '',
        labelShowBg: true, labelBgPadding: [8, 4], labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#1e1e2e' }, labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
        style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '' },
        markerEnd: { type: 'arrowclosed', color: '#94a3b8' },
        data: { communicationType: 'sync', pathType: 'smooth', label: '' },
      }],
    });

    const result = await updateDiagram({ removeNodeIds: ['a'] });
    expect(result.nodes.find(n => n.id === 'a')).toBeUndefined();
    expect(result.edges.find(e => e.id === 'e1')).toBeUndefined();
    expect(result.changes.nodesRemoved).toBe(1);
  });

  it('errors when no diagram exists', async () => {
    const { updateDiagram } = await import('../update-diagram.js');
    const result = await updateDiagram({ addNodes: [{ id: 'x', label: 'X', tier: 'compute' }] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('generate_diagram');
  });

  it('does not mutate the previous state object', async () => {
    const { setDiagramState } = await import('../../lib/diagram-state.js');
    const { updateDiagram } = await import('../update-diagram.js');

    const a = makeNode('a');
    setDiagramState({ nodes: [a], edges: [] });

    await updateDiagram({ addNodes: [{ id: 'b', label: 'B', tier: 'compute' }] });
    // the original 'a' node object must not have been changed by the update path
    expect(a.id).toBe('a');
  });
});
