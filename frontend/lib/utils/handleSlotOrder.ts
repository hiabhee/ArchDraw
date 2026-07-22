import { Position, type Edge } from 'reactflow';
import { resolveSideFromEdgeHandles } from './simpleFloatingEdge';

export interface DynamicSlotOffsets {
  incomingOffset: number;
  outgoingOffset: number;
  centered: boolean;
}

const INCOMING_OUTGOING_GAP = 16;
const DEFAULT_OUTGOING = -INCOMING_OUTGOING_GAP;
const DEFAULT_INCOMING = INCOMING_OUTGOING_GAP;
const HYSTERESIS_PX = 4;

function isHorizontalSide(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

function nodeCenter(
  pos: { x: number; y: number; width: number; height: number },
): { cx: number; cy: number } {
  return { cx: pos.x + pos.width / 2, cy: pos.y + pos.height / 2 };
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
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>,
): DynamicSlotOffsets {
  let incomingSum = 0;
  let incomingCount = 0;
  let outgoingSum = 0;
  let outgoingCount = 0;
  let anySideResolved = false;

  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const edgeSide = resolveSideFromEdgeHandles(edge, nodeId);
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
