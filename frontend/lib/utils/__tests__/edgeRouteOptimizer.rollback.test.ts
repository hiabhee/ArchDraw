import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { buildEdgePathGeometry } from '../edgePathGeometry';
import { optimizeEdgeRoutes } from '../edgeRouteOptimizer';

const route = vi.hoisted(() => vi.fn());
vi.mock('../edgeRouteBuilder', () => ({ computeEdgeRoute: route, createEdgeRoutingContext: () => ({}) }));

describe('route repair acceptance', () => {
  it('restores the prior routes when a rip-up pass worsens the objective', () => {
    let calls = 0;
    route.mockImplementation(() => {
      const length = ++calls === 1 ? 100 : 1000;
      const path = { kind: 'orthogonal' as const, waypoints: [{ x: 0, y: 0 }, { x: length, y: 0 }], cornerRadius: 0 };
      const renderedPath = buildEdgePathGeometry(path);
      return {
        sourcePosition: 'right', targetPosition: 'left', sourcePoint: path.waypoints[0], targetPoint: path.waypoints[1],
        waypoints: path.waypoints, svgPath: renderedPath.d, path, renderedPath,
        status: 'invalid', violations: [], expandedStates: 0,
      };
    });
    const nodes = [
      { id: 'a', type: 'systemNode', data: { label: 'A' }, position: { x: 0, y: 0 } },
      { id: 'b', type: 'systemNode', data: { label: 'B' }, position: { x: 400, y: 0 } },
    ] as Node[];
    const edges = [{ id: 'ab', source: 'a', target: 'b' }] as Edge[];
    const result = optimizeEdgeRoutes({ nodes, edges, direction: 'LR', searchBudget: { ripUpPasses: 1 } });
    expect(result.routes.get('ab')?.renderedPath.length).toBe(100);
  });
});
