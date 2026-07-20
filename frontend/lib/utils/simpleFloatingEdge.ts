import { Edge, Node, Position } from 'reactflow';

export interface EdgePositions {
  sourcePos: Position;
  targetPos: Position;
}

type HandleType = 'source' | 'target';

const EDGE_ENDPOINT_GAP = 24;

export function getNodeCenter(node: Node) {
  const x = node.positionAbsolute?.x ?? node.position.x;
  const y = node.positionAbsolute?.y ?? node.position.y;
  const width = node.width ?? 160;
  const height = node.height ?? 80;
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
 * Terminal attachment for one end of an edge.
 * - Leaving a node  (source end) → outgoing / source handle (−GAP)
 * - Entering a node (target end) → incoming / target handle (+GAP)
 *
 * All same-role edges on a side therefore share one tip (merge by type).
 * Opposite roles stay on opposite tips.
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
  const [nodeId, edgeId, , edges] = args;

  const self = edges.find(
    (e) => e.id === edgeId && (e.source === nodeId || e.target === nodeId),
  );
  if (!self) return 0;

  const isIncoming = self.target === nodeId;
  const { sourceOffset, targetOffset } = getHandleSlotLayout();
  return isIncoming ? targetOffset : sourceOffset;
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
): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: nodeX - EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + shiftOffset };
    case Position.Right:
      return { x: nodeX + width + EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + shiftOffset };
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
  handleType: HandleType = 'source'
): { x: number; y: number } {
  void handleType;
  const axisOffset = shiftOffset;

  switch (position) {
    case Position.Left:
      return { x: nodeX - EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + axisOffset };
    case Position.Right:
      return { x: nodeX + width + EDGE_ENDPOINT_GAP, y: nodeY + height / 2 + axisOffset };
    case Position.Top:
      return { x: nodeX + width / 2 + axisOffset, y: nodeY - EDGE_ENDPOINT_GAP };
    case Position.Bottom:
      return { x: nodeX + width / 2 + axisOffset, y: nodeY + height + EDGE_ENDPOINT_GAP };
  }
}
