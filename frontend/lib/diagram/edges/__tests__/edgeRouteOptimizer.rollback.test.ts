import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { buildEdgePathGeometry } from '../edgePathGeometry';
import { optimizeEdgeRoutes } from '../edgeRouteOptimizer';

const route = vi.hoisted(() => vi.fn());
vi.mock('../edgeRouteBuilder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../edgeRouteBuilder')>()),
  computeEdgeRoute: route,
  createEdgeRoutingContext: () => ({ nodeById: new Map() }),
}));

describe('route repair acceptance', () => {
  it('prefers one crossing over a shorter route that crosses the same edge twice', () => {
    const up = [{ x: 0, y: 114 }, { x: 183, y: 114 }, { x: 183, y: -30 }];
    const interlocking = [{ x: 98, y: 240 }, { x: 98, y: 68 }, { x: 440, y: 68 }];
    const alternative = [{ x: 98, y: 240 }, { x: 250, y: 240 }, { x: 250, y: 68 }, { x: 440, y: 68 }];
    // A longer alternate attachment clears the local pair, but still crosses
    // a third edge. Its one remaining crossing should beat the old pair of two.
    const barrier = [{ x: 210, y: 164 }, { x: 290, y: 164 }];
    route.mockImplementation((edge: Edge, _nodes, _edges, _direction, _style, _anchors, _iconMode, options) => {
      const waypoints = edge.id === 'up' ? up
        : edge.id === 'barrier' ? barrier
        : options.attachmentSides ? alternative : interlocking;
      const path = { kind: 'orthogonal' as const, waypoints, cornerRadius: 30 };
      const renderedPath = buildEdgePathGeometry(path);
      return {
        sourcePosition: 'right', targetPosition: 'left', sourcePoint: waypoints[0], targetPoint: waypoints.at(-1),
        waypoints, svgPath: renderedPath.d, path, renderedPath,
        status: 'ok', violations: [], expandedStates: 0,
      };
    });
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({
      id, type: 'systemNode', data: { label: id }, position: { x: i * 200, y: 0 },
    })) as Node[];
    const edges = [
      { id: 'up', source: 'a', target: 'b', data: { customWaypoints: up.slice(1, -1) } },
      { id: 'barrier', source: 'c', target: 'd', data: { customWaypoints: barrier } },
      { id: 'right', source: 'e', target: 'f' },
    ] as Edge[];
    const result = optimizeEdgeRoutes({ nodes, edges, direction: 'LR', repairReturnCrossings: true, searchBudget: { ripUpPasses: 0 } });
    expect(result.routes.get('right')?.waypoints).toEqual(alternative);
  });

  it('detects sibling crossings away from their shared source', () => {
    let crossing = true;
    route.mockImplementation((edge: Edge) => {
      const waypoints = edge.id === 'sa'
        ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 300, y: 200 }]
        : [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: crossing ? 100 : -100 }, { x: 250, y: crossing ? 100 : -100 }];
      const path = { kind: 'orthogonal' as const, waypoints, cornerRadius: 0 };
      const renderedPath = buildEdgePathGeometry(path);
      return {
        sourcePosition: 'right', targetPosition: 'left', sourcePoint: waypoints[0], targetPoint: waypoints.at(-1),
        waypoints, svgPath: renderedPath.d, path, renderedPath,
        status: 'ok', violations: [], expandedStates: 0,
      };
    });
    const nodes = ['s', 'a', 'b'].map(id => ({
      id, type: 'systemNode', data: { label: id }, position: { x: 0, y: 0 },
    })) as Node[];
    const edges = [{ id: 'sa', source: 's', target: 'a' }, { id: 'sb', source: 's', target: 'b' }] as Edge[];
    const input = { nodes, edges, direction: 'LR' as const, searchBudget: { maxCandidateRoutes: 2, ripUpPasses: 0 } };
    expect(optimizeEdgeRoutes(input).diagnostics.filter(item => item.kind === 'crossing')).toHaveLength(1);
    crossing = false;
    expect(optimizeEdgeRoutes(input).diagnostics.filter(item => item.kind === 'crossing')).toHaveLength(0);
  });

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
