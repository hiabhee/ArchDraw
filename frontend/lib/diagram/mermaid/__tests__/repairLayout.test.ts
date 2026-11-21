import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeDiagramGeometryPlan } from '../../geometry/diagramGeometry';
import { acceptsLayoutRepair, repairDiagramLayout } from '../repairLayout';
import { layoutDiagramViaMermaid } from '../relayout';
vi.mock('../relayout', () => ({ layoutDiagramViaMermaid: vi.fn() }));
const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, width: 200, height: 88, data: { label: 'API' } },
  { id: 'b', position: { x: 50, y: 0 }, width: 200, height: 88, data: { label: 'DB' } },
];
describe('bounded layout repair', () => {
  it('rejects exchanging collisions for crossings, failures or worse fit', () => {
    const before = computeDiagramGeometryPlan(nodes, [], { direction: 'LR', straightEdges: true });
    const after = { ...before, status: 'ok' as const, violations: [], quality: { ...before.quality, hardViolations: 0 } };
    expect(acceptsLayoutRepair(before, after, 1, 0.95)).toBe(true);
    expect(acceptsLayoutRepair(before, after, 1, 0.89)).toBe(false);
    for (const field of ['weightedCrossings', 'criticalPathDisconnectCount', 'unexplainedPrivateOverlapLength'] as const) {
      expect(acceptsLayoutRepair(before, { ...after, quality: { ...after.quality, [field]: 1 } }, 1, 1)).toBe(false);
    }
    expect(acceptsLayoutRepair(before, before, 1, 1)).toBe(false);
  });
  it('preserves identity and input data when repairing overlap', async () => {
    vi.mocked(layoutDiagramViaMermaid).mockResolvedValue({ nodes: nodes.map((node, i) => ({ ...node, position: { x: i * 200, y: 0 } })), edges: [], success: true, warnings: [] });
    const edges: never[] = [];
    const result = await repairDiagramLayout(nodes, edges, 'LR');
    expect(result.repaired).toBe(true);
    expect(result.edges).toBe(edges);
    expect(result.nodes.map(node => node.id)).toEqual(['a', 'b']);
    expect(nodes[1].position.x).toBe(50);
  });
  it('never rewrites user edge metadata or removes custom routes', async () => {
    const edges: Edge[] = [{ id: 'manual', source: 'a', target: 'b', label: 'Read account data', data: { customWaypoints: [{ x: 300, y: 200 }], responseLabel: 'Account result' } }];
    vi.mocked(layoutDiagramViaMermaid).mockResolvedValue({ nodes, edges: [], success: true, warnings: [] });
    const result = await repairDiagramLayout(nodes, edges, 'LR');
    expect(result.edges).toBe(edges);
    expect(result.edges[0]).toBe(edges[0]);
    expect(result.edges[0].data.customWaypoints).toEqual([{ x: 300, y: 200 }]);
  });
  it('repairs overlapping cards through the real Mermaid/Dagre pipeline', async () => {
    const actual = await vi.importActual<typeof import('../relayout')>('../relayout');
    vi.mocked(layoutDiagramViaMermaid).mockImplementationOnce(actual.layoutDiagramViaMermaid);
    const result = await repairDiagramLayout(nodes, [], 'LR');
    expect(result.repaired).toBe(true);
    expect(result.after.quality.hardViolations).toBe(0);
    expect(result.nodes).toHaveLength(nodes.length);
  });
  it('rejects a candidate that places a child outside its group', async () => {
    const grouped: Node[] = [{ id: 'group', type: 'groupNode', position: { x: 0, y: 0 }, width: 400, height: 300, data: {} }, ...nodes.map(node => ({ ...node, parentNode: 'group' }))];
    vi.mocked(layoutDiagramViaMermaid).mockResolvedValue({ nodes: grouped.map(node => node.id === 'b' ? { ...node, position: { x: 450, y: 0 } } : node), edges: [], success: true, warnings: [] });
    const result = await repairDiagramLayout(grouped, [], 'LR');
    expect(result.repaired).toBe(false);
    expect(result.nodes).toBe(grouped);
  });
  it('keeps the graph unchanged on layout failure', async () => {
    vi.mocked(layoutDiagramViaMermaid).mockResolvedValue({ nodes, edges: [], success: false, warnings: ['failed'] });
    const result = await repairDiagramLayout(nodes, [], 'LR');
    expect(result.repaired).toBe(false);
    expect(result.nodes).toBe(nodes);
  });
});
