import type { Edge, Node } from 'reactflow';
import type { EdgeRouteResult } from './edgeRouteBuilder';
import { getNodeRect, isGroupNode } from './edgeRouteBuilder';
import { buildEdgePathGeometry, getRenderedPathInteraction } from './edgePathGeometry';
import type { NodeIconMode } from '../nodes/nodeIconVisibility';

/**
 * Edges that leave (or enter) a node from the same anchor all turn onto one line: two or more
 * arrows drawn as a single wire, so a reader cannot tell them apart or follow each one. This pass
 * gives every edge of such a fan its own lane, FAN_LANE_GAP apart, on the run where they would
 * share the line (the trunk: the leg after the stub out of the shared anchor).
 *
 * Lanes are nested so the fan never crosses itself: when the edges turn away from the shared node
 * after the trunk, the edge whose trunk is longest (the farthest end) takes the lane nearest the
 * node; when they turn back towards it, that edge takes the outermost lane. A lane is only used if
 * the moved route clears every card and keeps its stub; otherwise the edges keep the shared line.
 */
export const FAN_LANE_GAP = 14;
/** Trunks closer than this are drawn on top of each other. */
const SAME_LINE = 3;
/** Shortest stub left between the anchor and a lane moved towards the node. */
const MIN_STUB = 12;
/** Space kept between a moved lane and a card it passes. */
const CARD_CLEARANCE = 4;

type Pt = { x: number; y: number };
type Rect = { id: string; x: number; y: number; w: number; h: number };

interface Trunk {
  edgeId: string;
  /** Waypoints oriented so index 0 is the shared anchor. */
  points: Pt[];
  reversed: boolean;
  /** Axis of the trunk: 'x' for a vertical trunk (its coordinate is x), 'y' for a horizontal one. */
  axis: 'x' | 'y';
  coord: number;
  /** +1 / -1: direction of the stub along the trunk's coordinate axis (away from the node). */
  outward: number;
  /** Direction the trunk runs (+1 / -1 along the other axis). */
  runs: number;
  length: number;
  /** True when the leg after the trunk heads back towards the shared node. */
  turnsBack: boolean;
}

const isOrthogonal = (points: readonly Pt[]) =>
  points.every((p, i) => i === 0 || Math.abs(p.x - points[i - 1].x) < 0.5 || Math.abs(p.y - points[i - 1].y) < 0.5);

/** The trunk of a route seen from its anchor end, or null when it has none that a lane could move. */
function trunkOf(edgeId: string, waypoints: readonly Pt[], reversed: boolean): Trunk | null {
  const points = reversed ? [...waypoints].reverse() : [...waypoints];
  // anchor → stub end → trunk end → … : the trunk must not end at the far terminal, which cannot move.
  if (points.length < 4 || !isOrthogonal(points)) return null;
  const [a, b, c, d] = points;
  const stubHorizontal = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) >= 0.5;
  const stubVertical = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5;
  if (!stubHorizontal && !stubVertical) return null;
  const axis: 'x' | 'y' = stubHorizontal ? 'x' : 'y';
  const other: 'x' | 'y' = axis === 'x' ? 'y' : 'x';
  // The trunk runs across the stub: same coordinate on the stub's axis, moving along the other.
  if (Math.abs(b[axis] - c[axis]) >= 0.5 || Math.abs(b[other] - c[other]) < 0.5) return null;
  const outward = Math.sign(b[axis] - a[axis]);
  const next = Math.sign(d[axis] - c[axis]);
  return {
    edgeId,
    points,
    reversed,
    axis,
    coord: b[axis],
    outward,
    runs: Math.sign(c[other] - b[other]),
    length: Math.abs(c[other] - b[other]),
    turnsBack: next !== 0 && next !== outward,
  };
}

function segmentHitsRect(p: Pt, q: Pt, r: Rect): boolean {
  const minX = Math.min(p.x, q.x), maxX = Math.max(p.x, q.x);
  const minY = Math.min(p.y, q.y), maxY = Math.max(p.y, q.y);
  return maxX > r.x - CARD_CLEARANCE && minX < r.x + r.w + CARD_CLEARANCE
    && maxY > r.y - CARD_CLEARANCE && minY < r.y + r.h + CARD_CLEARANCE;
}

function withLane(trunk: Trunk, coord: number): Pt[] {
  const points = trunk.points.map(p => ({ ...p }));
  points[1][trunk.axis] = coord;
  points[2][trunk.axis] = coord;
  return trunk.reversed ? points.reverse() : points;
}

function rebuilt(route: EdgeRouteResult, waypoints: Pt[]): EdgeRouteResult {
  const cornerRadius = route.path.kind === 'orthogonal' ? route.path.cornerRadius : 0;
  const path = { kind: 'orthogonal' as const, waypoints, cornerRadius };
  const renderedPath = buildEdgePathGeometry(path);
  return { ...route, waypoints, path, renderedPath, svgPath: renderedPath.d };
}

export function separateFanLanes(
  routes: Map<string, EdgeRouteResult>,
  edges: readonly Edge[],
  nodes: readonly Node[],
  renderStyleId?: string,
  iconMode?: NodeIconMode,
): void {
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const cards: Rect[] = nodes
    .filter(node => !isGroupNode(node))
    .map(node => ({ id: node.id, ...getNodeRect(node, nodes as Node[], renderStyleId, iconMode) }));

  // Fans: edges sharing one anchor point on one node, seen from that end.
  const fans = new Map<string, Trunk[]>();
  for (const [edgeId, route] of routes) {
    const edge = edgeById.get(edgeId);
    if (!edge || route.status !== 'ok' || route.path.kind !== 'orthogonal') continue;
    if (Array.isArray((edge.data as { customWaypoints?: unknown[] } | undefined)?.customWaypoints)
      && ((edge.data as { customWaypoints: unknown[] }).customWaypoints.length > 0)) continue;
    for (const [nodeId, reversed] of [[edge.source, false], [edge.target, true]] as const) {
      const trunk = trunkOf(edgeId, route.waypoints, reversed);
      if (!trunk) continue;
      const anchor = trunk.points[0];
      const key = `${nodeId}|${Math.round(anchor.x / 4)}|${Math.round(anchor.y / 4)}|${trunk.axis}|${trunk.outward}|${trunk.runs}`;
      const fan = fans.get(key) ?? [];
      fan.push(trunk);
      fans.set(key, fan);
    }
  }

  const moved = new Set<string>();
  for (const [key, fan] of fans) {
    const nodeId = key.split('|')[0];
    // Only trunks drawn on one line need lanes (a fan whose edges already turn apart is fine).
    const shared = fan.filter(t => !moved.has(t.edgeId) && fan.some(o => o !== t && Math.abs(o.coord - t.coord) <= SAME_LINE));
    if (shared.length < 2) continue;
    const base = Math.min(...shared.map(t => t.outward * t.coord)) * shared[0].outward;
    const anchorCoord = shared[0].points[0][shared[0].axis];
    // Nesting (see above): innermost lane first.
    const ordered = [...shared].sort((a, b) =>
      (a.turnsBack ? a.length - b.length : b.length - a.length) || a.edgeId.localeCompare(b.edgeId));
    const outward = shared[0].outward;

    const tryLanes = (offsets: number[]): Map<string, EdgeRouteResult> | null => {
      const next = new Map<string, EdgeRouteResult>();
      for (let i = 0; i < ordered.length; i++) {
        const trunk = ordered[i];
        const coord = base + outward * offsets[i];
        if ((coord - anchorCoord) * outward < MIN_STUB) return null;
        // The leg after the trunk keeps its direction (a lane past the next corner would double back).
        const after = trunk.points[3][trunk.axis];
        if ((trunk.turnsBack ? coord - after : after - coord) * outward < MIN_STUB) return null;
        const waypoints = withLane(trunk, coord);
        const edge = edgeById.get(trunk.edgeId)!;
        const ends = new Set([edge.source, edge.target, nodeId]);
        for (let s = 1; s < waypoints.length; s++) {
          for (const card of cards) {
            if (ends.has(card.id)) continue;
            if (segmentHitsRect(waypoints[s - 1], waypoints[s], card)) return null;
          }
        }
        next.set(trunk.edgeId, rebuilt(routes.get(trunk.edgeId)!, waypoints));
      }
      // Shared endpoints may meet, but sibling edges must not gain a crossing farther along.
      for (const [edgeId, route] of next) {
        const before = routes.get(edgeId)!;
        for (const [otherId, otherRoute] of routes) {
          if (otherId === edgeId) continue;
          const other = edgeById.get(otherId);
          if (!other) continue;
          const drawn = next.get(otherId) ?? otherRoute;
          if (getRenderedPathInteraction(route.renderedPath, drawn.renderedPath).crossing
            && !getRenderedPathInteraction(before.renderedPath, otherRoute.renderedPath).crossing) return null;
        }
      }
      return next;
    };

    const n = ordered.length;
    const outwardOnly = ordered.map((_, i) => i * FAN_LANE_GAP);
    const centred = ordered.map((_, i) => (i - (n - 1) / 2) * FAN_LANE_GAP);
    const applied = tryLanes(outwardOnly) ?? tryLanes(centred);
    if (!applied) continue;
    for (const [edgeId, route] of applied) {
      routes.set(edgeId, route);
      moved.add(edgeId);
    }
  }
}
