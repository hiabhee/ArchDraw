import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeEdgeRoute } from '../edgeRouteBuilder';
import { segmentIntersectsRect } from '../collisionFreeEdgePath';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function makeGroup(id: string, x: number, y: number, w: number, h: number): Node {
  return {
    id,
    type: 'groupNode',
    position: { x, y },
    width: w,
    height: h,
    style: { width: w, height: h },
    data: { isGroup: true },
  } as Node;
}

function makeChild(id: string, parentId: string, x: number, y: number, w = 120, h = 70): Node {
  return {
    id,
    type: 'shapeNode',
    position: { x, y },
    parentId,
    parentNode: parentId,
    width: w,
    height: h,
    data: {},
  } as Node;
}

function makeNode(id: string, x: number, y: number, w = 120, h = 70): Node {
  return {
    id,
    type: 'shapeNode',
    position: { x, y },
    width: w,
    height: h,
    data: {},
  } as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'default', data: {} } as Edge;
}

function pathHitsRect(points: Array<{ x: number; y: number }>, rect: Rect): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (
      segmentIntersectsRect(
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
      )
    ) {
      return true;
    }
  }
  return false;
}

describe('computeEdgeRoute group-node handling', () => {
  it('passes an edge inside a group straight through another group’s empty space', () => {
    // Nodes A and B both live in grpA; grpB is a separate group sitting in the
    // middle of the direct path between them. Groups are passable: only cards
    // block an edge, so the shortest route is a straight line.
    const grpA = makeGroup('grpA', 0, 0, 900, 200);
    const s = makeChild('s', 'grpA', 80, 70);
    const t = makeChild('t', 'grpA', 700, 70);
    const grpB = makeGroup('grpB', 400, 55, 140, 90);

    const nodes = [grpA, s, t, grpB];
    const edge = makeEdge('e1', 's', 't');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBe(2);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('passes an edge between two groups straight through a third group’s space', () => {
    const grpA = makeGroup('grpA', 0, 0, 300, 200);
    const grpC = makeGroup('grpC', 600, 0, 300, 200);
    const s = makeChild('s', 'grpA', 80, 70);
    const t = makeChild('t', 'grpC', 80, 70);
    const grpB = makeGroup('grpB', 350, 55, 200, 90);

    const nodes = [grpA, s, grpB, t, grpC];
    const edge = makeEdge('e1', 's', 't');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBe(2);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('passes an edge from a group to a free node straight through an unrelated group’s space', () => {
    const grpA = makeGroup('grpA', 0, 0, 300, 200);
    const s = makeChild('s', 'grpA', 80, 70);
    const t = makeNode('t', 700, 70);
    const grpB = makeGroup('grpB', 350, 55, 200, 90);

    const nodes = [grpA, s, grpB, t];
    const edge = makeEdge('e1', 's', 't');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    expect(route.waypoints.length).toBe(2);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('does not treat a node as an obstacle when it is inside the same group', () => {
    // grpB sits between the nodes, but BOTH endpoints belong to grpB — the
    // edge must be allowed to travel freely inside its own group.
    const grpB = makeGroup('grpB', 0, 0, 900, 200);
    const s = makeChild('s', 'grpB', 80, 70);
    const t = makeChild('t', 'grpB', 700, 70);

    const nodes = [grpB, s, t];
    const edge = makeEdge('e1', 's', 't');
    const route = computeEdgeRoute(edge, nodes, [edge], 'LR');

    // No unrelated groups exist, so a straight in-group path is expected —
    // not a detour. (Degenerate Z midpoints are collapsed to 2 points.)
    expect(route.waypoints.length).toBe(2);
    expect(route.waypoints[0]).toEqual(route.sourcePoint);
    expect(route.waypoints[route.waypoints.length - 1]).toEqual(route.targetPoint);
  });

  it('keeps normal node avoidance unchanged when no groups are present', () => {
    // Use plain nodes (not shapeNode) so explicit w/h are respected and not
    // recomputed via shape sizing (which now defaults rect to 200×~98).
    const s: Node = { id: 's', type: 'default', position: { x: 0, y: 100 }, width: 120, height: 70, data: {} } as unknown as Node;
    const t: Node = { id: 't', type: 'default', position: { x: 500, y: 100 }, width: 120, height: 70, data: {} } as unknown as Node;
    const blocker: Node = { id: 'blocker', type: 'default', position: { x: 260, y: 70 }, width: 120, height: 140, data: {} } as unknown as Node;

    const edge = makeEdge('e1', 's', 't');
    const route = computeEdgeRoute(edge, [s, blocker, t], [edge], 'LR');

    expect(pathHitsRect(route.waypoints, { x: 260, y: 70, w: 120, h: 140 })).toBe(false);
  });
});
