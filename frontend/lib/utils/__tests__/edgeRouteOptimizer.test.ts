import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { optimizeEdgeRoutes, getEdgeRoutePriority } from '../edgeRouteOptimizer';
import { resolveEdgeFlowSemantics } from '@/lib/mermaid/edgeFlowSemantics';

const node = (id: string, x: number, y: number): Node => ({
  id, type: 'systemNode', position: { x, y }, width: 200, height: 100, data: { label: id },
} as Node);
const edge = (id: string, importance: string): Edge => ({
  id, source: 'a', target: 'b', data: { label: id, importance },
} as Edge);

describe('optimizeEdgeRoutes', () => {
  it('uses inferred main-flow semantics when ordering routes for imported graphs', () => {
    const nodes = [
      { id: 'client', type: 'shapeNode', data: { label: 'Client' }, position: { x: 0, y: 0 } },
      { id: 'api', type: 'systemNode', data: { label: 'API' }, position: { x: 200, y: 0 } },
      { id: 'result', type: 'shapeNode', data: { label: 'Result' }, position: { x: 400, y: 0 } },
      { id: 'observer', type: 'systemNode', data: { label: 'Observer' }, position: { x: 200, y: 220 } },
      { id: 'metrics', type: 'systemNode', data: { label: 'Metrics' }, position: { x: 400, y: 220 } },
    ] as Node[];
    const edges = [
      { id: 'client-api', source: 'client', target: 'api', data: {} },
      { id: 'api-result', source: 'api', target: 'result', data: {} },
      { id: 'aaa-support', source: 'observer', target: 'metrics', data: {} },
    ] as Edge[];
    const semantics = resolveEdgeFlowSemantics(nodes, edges);

    expect(semantics.assignments.get('client-api')?.role).toBe('main');
    expect(semantics.assignments.get('aaa-support')?.role).toBe('supporting');
    expect(getEdgeRoutePriority(edges[0], semantics.assignments.get('client-api')))
      .toBeGreaterThan(getEdgeRoutePriority(edges[2], semantics.assignments.get('aaa-support')));
  });

  it('allocates deterministic private lanes while preserving common terminal stubs', () => {
    const input = {
      nodes: [node('a', 100, 100), node('b', 600, 100)],
      edges: [edge('primary', 'primary'), edge('audit', 'supporting')],
      direction: 'LR' as const,
    };
    const first = optimizeEdgeRoutes(input);
    const shuffled = optimizeEdgeRoutes({ ...input, edges: [...input.edges].reverse() });
    const main = first.routes.get('primary')!;
    const supporting = first.routes.get('audit')!;

    expect(main.sourcePoint).toEqual(supporting.sourcePoint);
    expect(main.targetPoint).toEqual(supporting.targetPoint);
    expect(main.svgPath).not.toBe(supporting.svgPath);
    expect(shuffled.routes.get('primary')?.svgPath).toBe(main.svgPath);
    expect(shuffled.routes.get('audit')?.svgPath).toBe(supporting.svgPath);
    expect(first.stats.candidateRoutes).toBeLessThanOrEqual(30);
    expect(first.stats.ripUpPasses).toBeLessThanOrEqual(2);
    expect(first.stats.expandedStates).toBe(0);
  });

  it('does not evaluate alternate lanes for spatially independent routes', () => {
    const nodes = [
      node('a', 0, 0), node('b', 400, 0),
      node('c', 0, 500), node('d', 400, 500),
    ];
    const edges = [
      { id: 'ab', source: 'a', target: 'b', data: {} },
      { id: 'cd', source: 'c', target: 'd', data: {} },
    ] as Edge[];

    const result = optimizeEdgeRoutes({ nodes, edges, direction: 'LR' });

    expect(result.stats.candidateRoutes).toBeLessThanOrEqual(edges.length);
    expect(result.stats.ripUpPasses).toBe(0);
  });

  it('keeps fixed custom paths fixed while rerouting automatic edges around them', () => {
    const nodes = [node('a', 100, 100), node('b', 600, 100)];
    const pinned = {
      ...edge('pinned', 'primary'),
      data: { label: 'pinned', importance: 'primary', customWaypoints: [{ x: 350, y: 180 }] },
    } as Edge;
    const automatic = edge('automatic', 'supporting');
    const result = optimizeEdgeRoutes({ nodes, edges: [automatic, pinned], direction: 'LR' });

    expect(result.routes.get('pinned')?.waypoints).toEqual(expect.arrayContaining([{ x: 350, y: 180 }]));
    expect(result.routes.get('automatic')?.svgPath).not.toBe(result.routes.get('pinned')?.svgPath);
  });

  it('keeps a clear feedback edge within the bounded route budget', () => {
    const nodes = [node('a', 100, 100), node('b', 600, 100)];
    const feedback = { ...edge('feedback', 'supporting'), data: { flowRole: 'feedback' } } as Edge;
    const result = optimizeEdgeRoutes({ nodes, edges: [feedback], direction: 'LR' });

    expect(result.stats.candidateRoutes).toBeGreaterThanOrEqual(1);
    expect(result.stats.ripUpPasses).toBeLessThanOrEqual(2);
    expect(result.routes.get('feedback')?.status).toBe('ok');
  });
});
