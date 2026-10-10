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
  it('snaps a near-aligned link (<8px) to a pixel-straight line at the midpoint', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 106)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    // 6px of vertical drift would read as a slanted wire — both ends meet at
    // the midpoint (153), staying inside either handle donut.
    expect(route.sourcePoint).toEqual({ x: 312, y: 153 });
    expect(route.targetPoint).toEqual({ x: 488, y: 153 });
    expect(route.waypoints).toEqual([route.sourcePoint, route.targetPoint]);
    expect(route.svgPath).toBe('M 312,153 L 488,153');
  });

  it('does not straighten a near-aligned link through another node', () => {
    const nodes = [
      makeNode('a', 100, 100),
      makeNode('b', 500, 106),
      makeNode('blocker', 355, 120, 80, 60),
    ];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('keeps a tiny off-axis jog as a routed path (no straight-snap)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual({ x: 312, y: 150 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 488, y: 162 });
  });

  it('keeps the routed Z path for a large vertical offset', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 300)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.waypoints[0]).toEqual({ x: 312, y: 150 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 488, y: 350 });
  });

  it('keeps parallel-edge separation (does not snap overlapping straights)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 112)];
    const e1 = makeEdge('e1', 'a', 'b');
    const e2 = makeEdge('e2', 'a', 'b');
    const route1 = computeEdgeRoute(e1, nodes, [e1, e2], 'LR');
    const route2 = computeEdgeRoute(e2, nodes, [e1, e2], 'LR');

    expect(route1.waypoints.length).toBeGreaterThan(2);
    expect(route2.waypoints.length).toBeGreaterThan(2);
    expect(route1.svgPath).not.toBe(route2.svgPath);
    expect(route1.sourcePoint).toEqual(route2.sourcePoint);
    expect(route1.targetPoint).toEqual(route2.targetPoint);
  });

  it('keeps a manually pinned direction fixed when a reciprocal edge exists', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)];
    const pinned = {
      ...makeEdge('a-b', 'a', 'b'),
      data: { sourceSide: 'top', targetSide: 'top' },
    } as Edge;
    const reverse = makeEdge('b-a', 'b', 'a');

    const route = computeEdgeRoute(pinned, nodes, [pinned, reverse], 'LR');

    expect(route.sourcePosition).toBe('top');
    expect(route.targetPosition).toBe('top');
  });

  it.each(['top', 'right', 'bottom', 'left'] as const)(
    'preserves a reciprocal manual %s/%s side pair',
    (side) => {
      const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)];
      const pinned = {
        ...makeEdge('a-b', 'a', 'b'),
        data: { sourceSide: side, targetSide: side },
      } as Edge;
      const reverse = makeEdge('b-a', 'b', 'a');

      const route = computeEdgeRoute(pinned, nodes, [pinned, reverse], 'LR');

      expect(route.sourcePosition).toBe(side);
      expect(route.targetPosition).toBe(side);
    },
  );

  it('exposes route validity instead of treating every fallback as successful', () => {
    const nodes = [
      makeNode('a', 100, 100),
      makeNode('b', 500, 100),
      makeNode('enclosure', 470, 120, 80, 60),
    ];
    const edge = {
      ...makeEdge('a-b', 'a', 'b'),
      data: { sourceSide: 'right', targetSide: 'left' },
    } as Edge;

    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route).toHaveProperty('status');
    expect(route).toHaveProperty('violations');
    expect(route.status).toBe('failed');
    expect(route.failureReason).toBe('no-path-found');
    expect(route.violations.length).toBeGreaterThan(0);
  });

  it('preserves unresolved route status from the detailed obstacle router', () => {
    const nodes = [
      makeNode('a', 100, 100),
      makeNode('b', 500, 100),
      makeNode('blocker', 330, 70, 100, 160),
    ];
    const edge = {
      ...makeEdge('a-b', 'a', 'b'),
      data: { sourceSide: 'right', targetSide: 'left' },
    } as Edge;

    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');
    expect(route.status).toBe('failed');
    expect(route.failureReason).toBe('no-path-found');
  });


  it('ignores stale measured anchors that left the scorer winner', () => {
    // Same-rank nodes: scorer puts terminals at Right (312,150) / Left (488,150).
    // Stored handle ids can point at a hidden handle elsewhere — the wire must
    // meet the visible handle, perpendicular to it, not empty canvas.
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR', undefined, {
      source: { x: 200, y: 60 },
      target: { x: 600, y: 200 },
    });

    expect(route.sourcePoint).toEqual({ x: 312, y: 150 });
    expect(route.targetPoint).toEqual({ x: 488, y: 150 });
    expect(route.sourcePosition).toBe('right');
    expect(route.targetPosition).toBe('left');
  });

  it('adopts fresh measured anchors that sit on the scorer winner', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)];
    const edge = makeEdge('e1', 'a', 'b');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR', undefined, {
      source: { x: 314, y: 150 },
      target: { x: 488, y: 150 },
    });

    // Within tolerance of the scored anchor: keep the live handle center so
    // the wire touches the rendered donut subpixel-exactly.
    expect(route.sourcePoint).toEqual({ x: 314, y: 150 });
    expect(route.targetPoint).toEqual({ x: 488, y: 150 });
  });

  it('keeps valid custom waypoints but coerces stale measured anchors', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)];
    const edge = {
      id: 'e1', source: 'a', target: 'b', type: 'default',
      data: { customWaypoints: [{ x: 400, y: 150 }] },
    } as Edge;
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR', undefined, {
      source: { x: 200, y: 60 },
      target: { x: 600, y: 200 },
    });

    // The user waypoint survives (axis-aligned with scorer terminals), but
    // the stale measured ends are replaced by the scored anchors.
    expect(route.sourcePoint).toEqual({ x: 312, y: 150 });
    expect(route.targetPoint).toEqual({ x: 488, y: 150 });
    expect(route.waypoints).toEqual([
      { x: 312, y: 150 },
      { x: 400, y: 150 },
      { x: 488, y: 150 },
    ]);
  });
});
