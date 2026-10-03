import { describe, it, expect } from 'vitest';
import { Position, type Edge, type Node } from 'reactflow';
import { computeEdgeRoute } from '../edgeRouteBuilder';
import { applyBidirectionalEdgeFixes } from '@/store/diagram/helpers/edgeHelpers';

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

function makeEdge(
  id: string,
  source: string,
  target: string,
  handles?: { sourceHandle: string; targetHandle: string },
  data?: Record<string, unknown>,
): Edge {
  return {
    id,
    source,
    target,
    type: 'simpleFloating',
    ...handles,
    data,
  } as Edge;
}

describe('bidirectional edge routing', () => {
  const nodes = [makeNode('web', 0, 100), makeNode('server', 400, 100)];

  it('clears stale customWaypoints and aligns facing handles', () => {
    const edges: Edge[] = [
      makeEdge('e1', 'web', 'server', { sourceHandle: 'source-top', targetHandle: 'target-bottom' }, {
        customWaypoints: [{ x: 200, y: 50 }, { x: 200, y: 250 }],
      }),
      makeEdge('e2', 'server', 'web', { sourceHandle: 'source-bottom', targetHandle: 'target-top' }, {
        customWaypoints: [{ x: 200, y: 250 }, { x: 200, y: 50 }],
      }),
    ];

    const fixed = applyBidirectionalEdgeFixes(edges, nodes);
    expect(fixed[0].sourceHandle).toBe('source-right');
    expect(fixed[0].targetHandle).toBe('target-left');
    expect(fixed[1].sourceHandle).toBe('source-left');
    expect(fixed[1].targetHandle).toBe('target-right');
    expect((fixed[0].data as { customWaypoints?: unknown } | undefined)?.customWaypoints).toBeUndefined();
    expect((fixed[1].data as { customWaypoints?: unknown } | undefined)?.customWaypoints).toBeUndefined();
  });

  it('routes parallel horizontal tracks without crossing center', () => {
    const edges: Edge[] = [
      makeEdge('e1', 'web', 'server', { sourceHandle: 'source-right', targetHandle: 'target-left' }),
      makeEdge('e2', 'server', 'web', { sourceHandle: 'source-left', targetHandle: 'target-right' }),
    ];

    const forward = computeEdgeRoute(edges[0], nodes, edges, 'LR');
    const reverse = computeEdgeRoute(edges[1], nodes, edges, 'LR');

    expect(forward.sourcePosition).toBe('right');
    expect(forward.targetPosition).toBe('left');
    expect(reverse.sourcePosition).toBe('left');
    expect(reverse.targetPosition).toBe('right');

    const forwardY = forward.sourcePoint.y;
    const reverseY = reverse.sourcePoint.y;
    expect(Math.abs(forwardY - reverseY)).toBeGreaterThan(20);

    const midX = 200;
    const forwardMidY = forward.waypoints.find((p) => Math.abs(p.x - midX) < 80)?.y ?? forwardY;
    const reverseMidY = reverse.waypoints.find((p) => Math.abs(p.x - midX) < 80)?.y ?? reverseY;
    expect(Math.abs(forwardMidY - reverseMidY)).toBeGreaterThan(20);
  });

  it('ignores customWaypoints when a reverse edge exists', () => {
    const edges: Edge[] = [
      makeEdge('e1', 'web', 'server', { sourceHandle: 'source-right', targetHandle: 'target-left' }, {
        customWaypoints: [{ x: 200, y: 50 }],
      }),
      makeEdge('e2', 'server', 'web', { sourceHandle: 'source-left', targetHandle: 'target-right' }),
    ];

    const route = computeEdgeRoute(edges[0], nodes, edges, 'LR');
    expect(route.waypoints.some((p) => p.y === 50)).toBe(false);
  });

  it('routes from live geometry when stored handles are stale after a node move', () => {
    const movedNodes = [makeNode('web', 0, 0), makeNode('server', 0, 220)];
    const edges: Edge[] = [
      makeEdge('e1', 'web', 'server', { sourceHandle: 'source-right', targetHandle: 'target-left' }),
      makeEdge('e2', 'server', 'web', { sourceHandle: 'source-left', targetHandle: 'target-right' }),
    ];

    const forward = computeEdgeRoute(edges[0], movedNodes, edges, 'LR');
    const reverse = computeEdgeRoute(edges[1], movedNodes, edges, 'LR');

    expect(forward.sourcePosition).toBe('bottom');
    expect(forward.targetPosition).toBe('top');
    expect(reverse.sourcePosition).toBe('top');
    expect(reverse.targetPosition).toBe('bottom');

    const forwardX = forward.sourcePoint.x;
    const reverseX = reverse.sourcePoint.x;
    expect(Math.abs(forwardX - reverseX)).toBeGreaterThan(20);
  });

  it('ignores custom waypoints with stale diagonal terminal joins', () => {
    const edge = makeEdge('e1', 'web', 'server', undefined, {
      sourceSide: 'bottom',
      targetSide: 'top',
      customWaypoints: [{ x: 180, y: 180 }],
    });
    const route = computeEdgeRoute(
      edge,
      [makeNode('web', 0, 0), makeNode('server', 0, 300)],
      [edge],
      'TD',
      undefined,
      {
        // Inside-node garbage (a real handle sits 12px outside the node):
        // must be coerced to the scored Bottom→Top anchors, not trusted.
        source: { x: 80, y: 80 },
        target: { x: 80, y: 300 },
        sourceSide: Position.Bottom,
        targetSide: Position.Top,
      },
    );

    expect(route.sourcePosition).toBe(Position.Bottom);
    expect(route.targetPosition).toBe(Position.Top);
    const xs = new Set(route.waypoints.map((point) => point.x));
    expect(xs.size).toBe(1);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('adopts fresh measured anchors that sit on the scorer winner', () => {
    // Effective box of a 160×80 system node is 200×100, so the live Right /
    // Left handle centers are (212, 50) and (388, 50) — pass those as the
    // measured anchors and they must be kept subpixel-exactly.
    const nodes = [makeNode('left', 0, 0, 160, 80), makeNode('right', 400, 0, 160, 80)];
    const edge = makeEdge('left-right', 'left', 'right');
    const route = computeEdgeRoute(
      edge,
      nodes,
      [edge],
      'LR',
      undefined,
      { source: { x: 212, y: 50 }, target: { x: 388, y: 50 } },
    );

    expect(route.sourcePosition).toBe(Position.Right);
    expect(route.targetPosition).toBe(Position.Left);
    expect(route.waypoints.every((point) => point.y === 50)).toBe(true);
  });
});
