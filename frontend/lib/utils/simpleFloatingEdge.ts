import { Edge, Node, Position } from 'reactflow';
import { computeDynamicSlotOffsets, getBidirectionalLaneOffset } from './handleSlotOrder';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';

export interface EdgePositions {
  sourcePos: Position;
  targetPos: Position;
}

type HandleType = 'source' | 'target';

const EDGE_ENDPOINT_GAP = 12;

export function getNodeCenter(node: Node) {
  const x = node.positionAbsolute?.x ?? node.position.x;
  const y = node.positionAbsolute?.y ?? node.position.y;
  const { width, height } = getEffectiveNodeDimensions(node);
  return { cx: x + width / 2, cy: y + height / 2, x, y, width, height };
}

export function getSimpleEdgePositions(
  sourceX: number ,
  sourceY: number,
  targetX: number,
  targetY: number
): EdgePositions {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  let sourcePos: Position;
  let targetPos: Position;

  // Direct axis comparison: whichever axis has the greater distance between centers
  // determines the handle direction (standard React Flow floating edge pattern).
  if (Math.abs(dy) > Math.abs(dx)) {
    if (dy > 0) {
      sourcePos = Position.Bottom;
      targetPos = Position.Top;
    } else {
      sourcePos = Position.Top;
      targetPos = Position.Bottom;
    }
  } else {
    if (dx > 0) {
      sourcePos = Position.Right;
      targetPos = Position.Left;
    } else {
      sourcePos = Position.Left;
      targetPos = Position.Right;
    }
  }

  return { sourcePos, targetPos };
}

/** Half-gap between dedicated incoming vs outgoing handle slots on a side (32px total). */
export const INCOMING_OUTGOING_GAP = 16;

export type EdgeSideResolver = (edge: Edge, nodeId: string) => Position;

/** Parse a React Flow handle id (`source-top`, `target-left`, …) into a side. */
export function sideFromHandleId(handleId: string | null | undefined): Position | undefined {
  if (!handleId) return undefined;
  if (handleId.endsWith('-left')) return Position.Left;
  if (handleId.endsWith('-right')) return Position.Right;
  if (handleId.endsWith('-top')) return Position.Top;
  if (handleId.endsWith('-bottom')) return Position.Bottom;
  return undefined;
}

/** Resolve which side of `nodeId` an edge uses from its stored handle ids. */
export function resolveSideFromEdgeHandles(edge: Edge, nodeId: string): Position | undefined {
  if (edge.source === nodeId) {
    return sideFromHandleId(edge.sourceHandle);
  }
  if (edge.target === nodeId) {
    return sideFromHandleId(edge.targetHandle);
  }
  return undefined;
}

/** Map a stored `data.sourceSide` / `data.targetSide` string to a Position. */
export function sideFromDataString(value: unknown): Position | undefined {
  if (value === 'left' || value === Position.Left) return Position.Left;
  if (value === 'right' || value === Position.Right) return Position.Right;
  if (value === 'top' || value === Position.Top) return Position.Top;
  if (value === 'bottom' || value === Position.Bottom) return Position.Bottom;
  return undefined;
}

/**
 * Resolve which side of `nodeId` an edge actually renders on. Mirrors the
 * route builder (`edgeRouteBuilder`): stored side override, then stored
 * handle id, then a geometric center-to-center inference as a last resort.
 * The geometric heuristic alone is not reliable — obstacle detours, lane
 * preferences and semantic ports can move an edge onto a different side.
 */
export function resolveEdgeTerminalSide(
  edge: Edge,
  nodeId: string,
  terminal: 'source' | 'target',
  nodeById?: Map<string, Node>,
): Position | undefined {
  const data = edge.data as Record<string, unknown> | undefined;
  const manual =
    terminal === 'target'
      ? sideFromDataString(data?.targetSide)
      : sideFromDataString(data?.sourceSide);
  if (manual !== undefined) return manual;

  const fromHandle = resolveSideFromEdgeHandles(edge, nodeId);
  if (fromHandle !== undefined) return fromHandle;

  if (!nodeById) return undefined;
  const src = nodeById.get(edge.source);
  const tgt = nodeById.get(edge.target);
  if (!src || !tgt) return undefined;
  const sc = getNodeCenter(src);
  const tc = getNodeCenter(tgt);
  const pos = getSimpleEdgePositions(sc.cx, sc.cy, tc.cx, tc.cy);
  return terminal === 'target' ? pos.targetPos : pos.sourcePos;
}

/**
 * Edges that converge onto the same terminal tip as `edgeId` on `nodeId`.
 * A tip is shared only by edges landing on the SAME side, so the marker
 * merge is only valid when the resolved sides agree. Edges whose rendered
 * side differs (even when geometry suggests otherwise) are kept apart so a
 * shared-tip merge never steals an edge's arrowhead.
 */
export function getSharedTerminalEdges(
  edgeId: string,
  nodeId: string,
  side: Position,
  edges: Edge[],
  nodeById?: Map<string, Node>,
  terminal: 'source' | 'target' = 'target',
): Edge[] {
  return edges
    .filter((e) => (terminal === 'target' ? e.target === nodeId : e.source === nodeId))
    .filter((e) =>
      e.id === edgeId
        ? true
        : resolveEdgeTerminalSide(e, nodeId, terminal, nodeById) === side,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Per-side slot layout for dedicated source (outgoing) / target (incoming) handles.
 *
 * Fixed contract (stable, never swaps):
 * - `sourceOffset` (−GAP) → ALL outgoing edges on this side share this tip
 * - `targetOffset` (+GAP) → ALL incoming edges on this side share this tip
 * - Incoming and outgoing never share a tip (32px apart)
 */
export function getHandleSlotLayout(): { sourceOffset: number; targetOffset: number } {
  return {
    sourceOffset: -INCOMING_OUTGOING_GAP,
    targetOffset: INCOMING_OUTGOING_GAP,
  };
}

/**
 * When only incoming or only outgoing edges exist on a given side of a node,
 * the active handle is centered (offset = 0) instead of split to the
 * dedicated incoming/outgoing slot (+/- GAP).
 */
function hasBothDirectionsOnSide(
  nodeId: string,
  side: Position,
  edges: Edge[],
  resolveSide?: EdgeSideResolver,
): boolean {
  if (!resolveSide) return true;
  if (!edges) return false;

  let hasIncoming = false;
  let hasOutgoing = false;
  for (const e of edges) {
    if (e.source !== nodeId && e.target !== nodeId) continue;
    if (resolveSide(e, nodeId) !== side) continue;
    if (e.target === nodeId) hasIncoming = true;
    else hasOutgoing = true;
    if (hasIncoming && hasOutgoing) return true;
  }
  return false;
}

/**
 * Terminal attachment for one end of an edge.
 * - Leaving a node  (source end) → outgoing / source handle (−GAP)
 * - Entering a node (target end) → incoming / target handle (+GAP)
 *
 * When only one direction (incoming OR outgoing) exists on a side,
 * the offset is 0 (centered) instead of +/- GAP.
 */
export function getEdgeShiftOffset(
  ...args: [
    nodeId: string,
    edgeId: string,
    side: Position,
    edges: Edge[],
    nodeInternals: Map<string, Node>,
    spacing?: number,
    allNodeRects?: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
    excludedNodeIds?: Set<string>,
    resolveSide?: EdgeSideResolver,
  ]
): number {
  const [nodeId, edgeId, side, edges, nodeInternals, , , , resolveSide] = args;

  const self = edges.find(
    (e) => e.id === edgeId && (e.source === nodeId || e.target === nodeId),
  );
  if (!self) return 0;

  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  if (nodeInternals) {
    for (const [id, node] of nodeInternals) {
      const x = node.positionAbsolute?.x ?? node.position.x;
      const y = node.positionAbsolute?.y ?? node.position.y;
      const { width, height } = getEffectiveNodeDimensions(node);
      nodePositions.set(id, {
        x,
        y,
        width,
        height,
      });
    }
  }

  const bidirectionalLane = getBidirectionalLaneOffset(self, nodeId, edges, nodePositions);
  if (bidirectionalLane !== null) return bidirectionalLane;

  if (!hasBothDirectionsOnSide(nodeId, side, edges, resolveSide)) return 0;

  const { incomingOffset, outgoingOffset } = computeDynamicSlotOffsets(
    nodeId, side, edges, nodePositions,
  );

  const isIncoming = self.target === nodeId;
  return isIncoming ? incomingOffset : outgoingOffset;
}

/**
 * Determines which sides of a node have only incoming or only outgoing edges.
 * Returns the set of side positions where the handle should be centered.
 */
export function getCenteredSides(
  nodeId: string,
  edges: Edge[],
  resolveSide?: EdgeSideResolver,
): Set<Position> {
  const centered = new Set<Position>();
  const sides: Position[] = [Position.Left, Position.Right, Position.Top, Position.Bottom];
  for (const side of sides) {
    if (!hasBothDirectionsOnSide(nodeId, side, edges, resolveSide)) {
      centered.add(side);
    }
  }
  return centered;
}


/**
 * Computes an anchor point 24px outside the node boundary for a given side.
 * The edge terminates with a gap between the node and the endpoint.
 * The shiftOffset distributes parallel edges along the side.
 */
export function getBoundaryAnchor(
  nodeX: number,
  nodeY: number,
  width: number,
  height: number,
  position: Position,
  shiftOffset: number = 0,
  contentBiasY: number = 0,
): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: nodeX - EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + shiftOffset + contentBiasY };
    case Position.Right:
      return { x: nodeX + width + EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + shiftOffset + contentBiasY };
    case Position.Top:
      return { x: nodeX + width / 2 + shiftOffset, y: nodeY - EDGE_ENDPOINT_GAP };
    case Position.Bottom:
      return { x: nodeX + width / 2 + shiftOffset, y: nodeY + height + EDGE_ENDPOINT_GAP };
  }
}

export function getSimpleHandlePosition(
  nodeX: number,
  nodeY: number,
  width: number,
  height: number,
  position: Position,
  shiftOffset: number = 0,
  handleType: HandleType = 'source',
  contentBiasY: number = 0,
): { x: number; y: number } {
  void handleType;
  const axisOffset = shiftOffset;

  switch (position) {
    case Position.Left:
      return { x: nodeX - EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + axisOffset + contentBiasY };
    case Position.Right:
      return { x: nodeX + width + EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + axisOffset + contentBiasY };
    case Position.Top:
      return { x: nodeX + width / 2 + axisOffset, y: nodeY - EDGE_ENDPOINT_GAP };
    case Position.Bottom:
      return { x: nodeX + width / 2 + axisOffset, y: nodeY + height + EDGE_ENDPOINT_GAP };
  }
}
