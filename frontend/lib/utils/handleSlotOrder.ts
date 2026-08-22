import type { Edge } from 'reactflow';
import { Position } from '@/lib/utils/edgePositions';
import { facingSideToward, type HandlerRect } from './handlerPairScorer';

export interface DynamicSlotOffsets {
  incomingOffset: number;
  outgoingOffset: number;
  centered: boolean;
}

const INCOMING_OUTGOING_GAP = 16;
const DEFAULT_OUTGOING = -INCOMING_OUTGOING_GAP;
const DEFAULT_INCOMING = INCOMING_OUTGOING_GAP;
const HYSTERESIS_PX = 4;

export { INCOMING_OUTGOING_GAP };

type SlotNodePos = { x: number; y: number; width: number; height: number };

function sideFromDataString(value: unknown): Position | undefined {
  if (value === 'left' || value === Position.Left) return Position.Left;
  if (value === 'right' || value === Position.Right) return Position.Right;
  if (value === 'top' || value === Position.Top) return Position.Top;
  if (value === 'bottom' || value === Position.Bottom) return Position.Bottom;
  return undefined;
}

/**
 * Which side of `nodeId` an edge renders on, mirroring the floating-side
 * router: explicit data override first, then center-to-center geometry.
 * Handle ids no longer pin sides.
 */
function inferEdgeSide(
  edge: Edge,
  nodeId: string,
  nodePositions?: Map<string, SlotNodePos>,
): Position | undefined {
  const data = edge.data as Record<string, unknown> | undefined;
  const manual = sideFromDataString(
    edge.source === nodeId ? data?.sourceSide : data?.targetSide,
  );
  if (manual !== undefined) return manual;

  if (!nodePositions) return undefined;
  const self = nodePositions.get(nodeId);
  const other = nodePositions.get(edge.source === nodeId ? edge.target : edge.source);
  if (!self || !other) return undefined;

  const dx = other.x + other.width / 2 - (self.x + self.width / 2);
  const dy = other.y + other.height / 2 - (self.y + self.height / 2);
  // The terminal side at `nodeId` always faces the other node along the
  // dominant axis — same rule for source and target ends.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

export function hasReverseEdge(edge: Edge, edges: Edge[]): boolean {
  return edges.some(
    (e) => e.id !== edge.id && e.source === edge.target && e.target === edge.source,
  );
}

/** Facing sides from live node geometry — used when nodes move and stored handles lag. */
export function resolveBidirectionalFacingSides(
  edge: Edge,
  edges: Edge[],
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
): { sourceSide: Position; targetSide: Position } | null {
  if (edge.source === edge.target || !hasReverseEdge(edge, edges)) return null;
  return {
    sourceSide: facingSideToward(sourceRect, targetRect),
    targetSide: facingSideToward(targetRect, sourceRect),
  };
}

/**
 * For a bidirectional pair, both ends of the same edge share one lane offset
 * so request/response paths run parallel instead of crossing.
 */
export function getBidirectionalLaneOffset(
  edge: Edge,
  nodeId: string,
  edges: Edge[],
  nodePositions?: Map<string, { x: number; y: number; width: number; height: number }>,
): number | null {
  if (edge.source === edge.target) return null;
  if (edge.source !== nodeId && edge.target !== nodeId) return null;
  if (!hasReverseEdge(edge, edges)) return null;

  const isForward = isForwardBidirectionalEdge(edge, nodePositions);
  return isForward ? DEFAULT_OUTGOING : DEFAULT_INCOMING;
}

function shouldSwapBidirectionalSideSlots(
  nodeId: string,
  side: Position,
  edges: Edge[],
  nodePositions: Map<string, SlotNodePos>,
  resolveSide?: (edge: Edge, nodeId: string) => Position | undefined,
): boolean {
  let neighborId: string | undefined;
  let hasIncoming = false;
  let hasOutgoing = false;

  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const edgeSide = resolveSide
      ? resolveSide(edge, nodeId)
      : inferEdgeSide(edge, nodeId, nodePositions);
    if (edgeSide !== side) continue;

    const other = edge.source === nodeId ? edge.target : edge.source;
    if (neighborId && neighborId !== other) return false;
    neighborId = other;
    if (edge.target === nodeId) hasIncoming = true;
    else hasOutgoing = true;
  }

  if (!neighborId || !hasIncoming || !hasOutgoing) return false;

  const hasReverse =
    edges.some((e) => e.source === neighborId && e.target === nodeId) &&
    edges.some((e) => e.source === nodeId && e.target === neighborId);
  if (!hasReverse) return false;

  return !isForwardSourceOfPair(nodeId, neighborId, nodePositions);
}

function isHorizontalSide(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

function nodeCenter(
  pos: { x: number; y: number; width: number; height: number },
): { cx: number; cy: number } {
  return { cx: pos.x + pos.width / 2, cy: pos.y + pos.height / 2 };
}

function isForwardSourceOfPair(
  nodeId: string,
  neighborId: string,
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>,
): boolean {
  const self = nodePositions.get(nodeId);
  const other = nodePositions.get(neighborId);
  if (!self || !other) return nodeId < neighborId;

  const { cx: sx, cy: sy } = nodeCenter(self);
  const { cx: ox, cy: oy } = nodeCenter(other);
  const dx = ox - sx;
  const dy = oy - sy;

  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0;
  return dy > 0;
}

function isForwardBidirectionalEdge(
  edge: Edge,
  nodePositions?: Map<string, { x: number; y: number; width: number; height: number }>,
): boolean {
  if (!nodePositions) return edge.source < edge.target;
  return isForwardSourceOfPair(edge.source, edge.target, nodePositions);
}

/**
 * Computes dynamic slot offsets for incoming vs outgoing handles on a given
 * side of a node. The ordering is derived from the relative positions of
 * connected nodes: the role whose connected nodes are "earlier" in the
 * tangential direction gets the first (negative) slot offset.
 *
 * For left/right sides: uses Y-centers of connected nodes.
 * For top/bottom sides: uses X-centers of connected nodes.
 */
export function computeDynamicSlotOffsets(
  nodeId: string,
  side: Position,
  edges: Edge[],
  nodePositions: Map<string, SlotNodePos>,
  resolveSide?: (edge: Edge, nodeId: string) => Position | undefined,
): DynamicSlotOffsets {
  if (!edges) return { incomingOffset: 0, outgoingOffset: 0, centered: true };
  let incomingSum = 0;
  let incomingCount = 0;
  let outgoingSum = 0;
  let outgoingCount = 0;
  let anySideResolved = false;

  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const edgeSide = resolveSide
      ? resolveSide(edge, nodeId)
      : inferEdgeSide(edge, nodeId, nodePositions);
    if (edgeSide === undefined) continue;
    if (edgeSide !== side) continue;
    anySideResolved = true;

    const isTarget = edge.target === nodeId;
    const otherNodeId = isTarget ? edge.source : edge.target;
    const otherPos = nodePositions.get(otherNodeId);
    if (!otherPos) continue;

    const { cx, cy } = nodeCenter(otherPos);
    const ref = isHorizontalSide(side) ? cy : cx;

    if (isTarget) {
      incomingSum += ref;
      incomingCount++;
    } else {
      outgoingSum += ref;
      outgoingCount++;
    }
  }

  if (!anySideResolved) {
    return {
      incomingOffset: DEFAULT_INCOMING,
      outgoingOffset: DEFAULT_OUTGOING,
      centered: false,
    };
  }

  if (incomingCount === 0 || outgoingCount === 0) {
    return { incomingOffset: 0, outgoingOffset: 0, centered: true };
  }

  if (shouldSwapBidirectionalSideSlots(nodeId, side, edges, nodePositions, resolveSide)) {
    return {
      incomingOffset: DEFAULT_OUTGOING,
      outgoingOffset: DEFAULT_INCOMING,
      centered: false,
    };
  }

  const incomingRef = incomingSum / incomingCount;
  const outgoingRef = outgoingSum / outgoingCount;
  const diff = incomingRef - outgoingRef;

  if (Math.abs(diff) <= HYSTERESIS_PX) {
    return {
      incomingOffset: DEFAULT_INCOMING,
      outgoingOffset: DEFAULT_OUTGOING,
      centered: false,
    };
  }

  if (diff < 0) {
    return {
      incomingOffset: DEFAULT_OUTGOING,
      outgoingOffset: DEFAULT_INCOMING,
      centered: false,
    };
  }

  return {
    incomingOffset: DEFAULT_INCOMING,
    outgoingOffset: DEFAULT_OUTGOING,
    centered: false,
  };
}
