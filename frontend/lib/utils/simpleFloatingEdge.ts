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

/** Half-gap between dedicated incoming and outgoing handle slots on a side (12px total). */
export const INCOMING_OUTGOING_GAP = 6;

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

/**
 * Peer coordinate along the side's tangent axis.
 * Left/Right sides fan along Y; Top/Bottom fan along X.
 */
function peerTangentCoord(
  peer: Node,
  side: Position,
): number {
  const { cx, cy } = getNodeCenter(peer);
  return side === Position.Left || side === Position.Right ? cy : cx;
}

function meanPeerTangent(
  edges: Edge[],
  nodeId: string,
  side: Position,
  nodeInternals: Map<string, Node>,
): number | null {
  if (edges.length === 0) return null;
  let sum = 0;
  let count = 0;
  for (const e of edges) {
    const peerId = e.source === nodeId ? e.target : e.source;
    const peer = nodeInternals.get(peerId);
    if (!peer) continue;
    sum += peerTangentCoord(peer, side);
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

/**
 * Chooses which side of the side-midpoint hosts incoming vs outgoing handles.
 * Places the group whose peers sit earlier on the tangent axis toward the
 * negative slot so edges run parallel instead of crossing. When peer means
 * tie (e.g. bidirectional pair), a stable node-id tie-break assigns opposite
 * signs on opposite endpoints so the two edges stay uncrossed.
 *
 * Returns signs applied to INCOMING_OUTGOING_GAP for each group.
 */
export function getIncomingOutgoingSlotSigns(
  nodeId: string,
  side: Position,
  incoming: Edge[],
  outgoing: Edge[],
  nodeInternals: Map<string, Node>,
): { incomingSign: 1 | -1; outgoingSign: 1 | -1 } {
  const inMean = meanPeerTangent(incoming, nodeId, side, nodeInternals);
  const outMean = meanPeerTangent(outgoing, nodeId, side, nodeInternals);

  if (inMean !== null && outMean !== null) {
    const delta = inMean - outMean;
    if (Math.abs(delta) > 1e-6) {
      // Peers with smaller tangent coord → negative slot (up / left).
      return delta < 0
        ? { incomingSign: -1, outgoingSign: 1 }
        : { incomingSign: 1, outgoingSign: -1 };
    }
  }

  // Tie / missing peers: stable opposite assignment across the connection.
  const peerIds = [
    ...incoming.map((e) => (e.source === nodeId ? e.target : e.source)),
    ...outgoing.map((e) => (e.source === nodeId ? e.target : e.source)),
  ].sort();
  const pivot = peerIds[0] ?? '';
  // Lower node id keeps outgoing on the negative slot (historical default).
  if (nodeId.localeCompare(pivot) <= 0) {
    return { incomingSign: 1, outgoingSign: -1 };
  }
  return { incomingSign: -1, outgoingSign: 1 };
}

/**
 * Per-side slot layout for dedicated source (outgoing) / target (incoming) handles.
 * Used by FloatingHandles to visually place the two dots, matching edge endpoints.
 */
export function getHandleSlotLayout(
  nodeId: string,
  side: Position,
  edges: Edge[],
  nodeInternals: Map<string, Node>,
  resolveSide?: EdgeSideResolver,
): { sourceOffset: number; targetOffset: number } {
  const onSide = edges.filter((e) => {
    if (e.source !== nodeId && e.target !== nodeId) return false;
    const s = resolveSide
      ? resolveSide(e, nodeId)
      : getEdgeSideForNode(e, nodeId, nodeInternals, side);
    return s === side;
  });

  const incoming = onSide.filter((e) => e.target === nodeId);
  const outgoing = onSide.filter((e) => e.source === nodeId);

  if (incoming.length === 0 || outgoing.length === 0) {
    // Default: outgoing (source) above/left, incoming (target) below/right.
    return {
      sourceOffset: -INCOMING_OUTGOING_GAP,
      targetOffset: INCOMING_OUTGOING_GAP,
    };
  }

  const { incomingSign, outgoingSign } = getIncomingOutgoingSlotSigns(
    nodeId,
    side,
    incoming,
    outgoing,
    nodeInternals,
  );
  return {
    sourceOffset: outgoingSign * INCOMING_OUTGOING_GAP,
    targetOffset: incomingSign * INCOMING_OUTGOING_GAP,
  };
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

  // Include all connected edges (persisted sourceHandle/targetHandle must not
  // disable slot separation — visual handles always sit on dedicated in/out slots).
  const connected = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId,
  );
  const self = connected.find((e) => e.id === edgeId);
  if (!self) return 0;

  const isIncoming = self.target === nodeId;

  // Filter to only edges on the same side of this node
  const onSide = connected.filter((e) => {
    if (e.id === edgeId) return true;
    const s = resolveSide
      ? resolveSide(e, nodeId)
      : getEdgeSideForNode(e, nodeId, nodeInternals, side);
    return s === side;
  });

  const incoming = onSide
    .filter((e) => e.target === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const outgoing = onSide
    .filter((e) => e.source === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const group = isIncoming ? incoming : outgoing;

  // Always attach to the dedicated in/out slot (matches FloatingHandles).
  // All edges in the same direction on this side SHARE one terminal point —
  // no within-group fan-out — so multiple incomings merge visually at one handler.
  if (incoming.length > 0 && outgoing.length > 0) {
    const { incomingSign, outgoingSign } = getIncomingOutgoingSlotSigns(
      nodeId,
      side,
      incoming,
      outgoing,
      nodeInternals,
    );
    return (isIncoming ? incomingSign : outgoingSign) * INCOMING_OUTGOING_GAP;
  }

  // Default layout: outgoing (source) above/left, incoming (target) below/right.
  void group;
  void spacing;
  return isIncoming ? INCOMING_OUTGOING_GAP : -INCOMING_OUTGOING_GAP;
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
