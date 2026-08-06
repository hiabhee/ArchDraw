import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
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
});
