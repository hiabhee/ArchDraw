import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeEdgeRoute } from '../edgeRouteBuilder';

function makeNode(id: string, x: number, y: number, w = 160, h = 80): Node {
  return {
    id,
    type: 'system',
    position: { x, y },
    width: w,
    height: h,
    data: {},
  } as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'default' } as Edge;
}

describe('computeEdgeRoute routing', () => {
  it('keeps a tiny off-axis jog as a routed path (no straight-snap)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual({ x: 272, y: 140 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 488, y: 152 });
  });

  it('keeps the routed Z path for a large vertical offset', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 300)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual({ x: 272, y: 140 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 488, y: 340 });
  });

  it('keeps parallel-edge separation (does not snap overlapping straights)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const e1 = makeEdge('e1', 'a', 'b');
    const e2 = makeEdge('e2', 'a', 'b');
    const route = computeEdgeRoute(e1, nodes, [e1, e2], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
  });
});
