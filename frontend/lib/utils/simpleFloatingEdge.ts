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

const INCOMING_OUTGOING_GAP = 6;

function getEdgeSideForNode(
  e: Edge,
  nodeId: string,
  nodeInternals: Map<string, Node> | undefined,
  side: Position
): Position {
  if (!nodeInternals) return side;
  const sourceNode = nodeInternals.get(e.source);
  const targetNode = nodeInternals.get(e.target);
  if (!sourceNode || !targetNode) return side;

  const srcCenter = getNodeCenter(sourceNode);
  const tgtCenter = getNodeCenter(targetNode);
  const { sourcePos, targetPos } = getSimpleEdgePositions(
    srcCenter.cx,
    srcCenter.cy,
    tgtCenter.cx,
    tgtCenter.cy
  );
  return e.source === nodeId ? sourcePos : targetPos;
}

export type EdgeSideResolver = (edge: Edge, nodeId: string) => Position;

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
  const [nodeId, edgeId, side, edges, nodeInternals, spacing = 24, , , resolveSide] = args;

  const connected = edges.filter(
    (e) =>
      (e.source === nodeId || e.target === nodeId) &&
      (e.sourceHandle ?? null) === null &&
      (e.targetHandle ?? null) === null,
  );
  if (connected.length <= 1) return 0;

  // Filter to only edges on the same side of this node
  const onSide = connected.filter((e) => {
    if (e.id === edgeId) return true;
    const s = resolveSide
      ? resolveSide(e, nodeId)
      : getEdgeSideForNode(e, nodeId, nodeInternals, side);
    return s === side;
  });

  if (onSide.length <= 1) return 0;

  const incoming = onSide
    .filter((e) => e.target === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const outgoing = onSide
    .filter((e) => e.source === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const isIncoming = incoming.some((e) => e.id === edgeId);
  const group = isIncoming ? incoming : outgoing;

  // We only need the incoming/outgoing separation gap if BOTH incoming and outgoing edges exist on this side
  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;
  const needGap = hasIncoming && hasOutgoing;
  const gap = needGap ? (isIncoming ? INCOMING_OUTGOING_GAP : -INCOMING_OUTGOING_GAP) : 0;

  if (group.length <= 1) {
    return gap;
  }

  const idx = group.findIndex((e) => e.id === edgeId);
  if (idx === -1) return 0;

  const center = ((group.length - 1) * spacing) / 2;
  const baseOffset = idx * spacing - center;
  return baseOffset + gap;
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
