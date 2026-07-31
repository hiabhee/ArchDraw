import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeEdgeRoute, snapSmallTwistToStraight } from '../edgeRouteBuilder';

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

describe('snapSmallTwistToStraight', () => {
  it('snaps a tiny off-axis jog to a straight line', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBe(2);
    expect(route.svgPath).toBe('M 272,140 L 488,152');
  });

  it('keeps the routed Z path for a large vertical offset', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 300)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual({ x: 272, y: 140 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 488, y: 340 });
  });

  it('does not snap when a straight segment would cross an obstacle node', () => {
    const source = { x: 272, y: 140 };
    const target = { x: 488, y: 152 };
    const waypoints = [
      { x: 272, y: 140 },
      { x: 380, y: 140 },
      { x: 380, y: 152 },
      { x: 488, y: 152 },
    ];
    const nodeRects = new Map([
      ['blocker', { id: 'blocker', x: 300, y: 100, w: 160, h: 80 }],
    ]);

    const result = snapSmallTwistToStraight(
      waypoints, source, target, 0, nodeRects,
      { x: 100, y: 100, w: 160, h: 80 },
      { x: 500, y: 112, w: 160, h: 80 },
    );

    expect(result).toBe(waypoints);
  });

  it('keeps parallel-edge separation (does not snap overlapping straights)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const e1 = makeEdge('e1', 'a', 'b');
    const e2 = makeEdge('e2', 'a', 'b');
    const route = computeEdgeRoute(e1, nodes, [e1, e2], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
  });
});
