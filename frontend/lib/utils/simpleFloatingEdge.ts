import type { Edge, Node } from 'reactflow';
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { Position } from '@/lib/utils/edgePositions';
import { computeDynamicSlotOffsets, getBidirectionalLaneOffset, inferEdgeSide } from './handleSlotOrder';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';

/** Half-gap between dedicated incoming vs outgoing handle slots on a side (32px total). */
export const INCOMING_OUTGOING_GAP = 16;

export type EdgeSideResolver = (edge: Edge, nodeId: string) => Position;

const EDGE_ENDPOINT_GAP = 12;

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
  if (!resolveSide) return false;
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
    renderStyleId?: string,
    iconMode?: NodeIconMode,
  ]
): number {
  const [nodeId, edgeId, side, edges, nodeInternals, , , , resolveSide, renderStyleId, iconMode] = args;

  const self = edges.find(
    (e) => e.id === edgeId && (e.source === nodeId || e.target === nodeId),
  );
  if (!self) return 0;

  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  if (nodeInternals) {
    for (const [id, node] of nodeInternals) {
      const x = node.positionAbsolute?.x ?? node.position.x;
      const y = node.positionAbsolute?.y ?? node.position.y;
      const { width, height } = getEffectiveNodeDimensions(node, renderStyleId, iconMode);
      nodePositions.set(id, {
        x,
        y,
        width,
        height,
      });
    }
  }
  const effectiveResolveSide = resolveSide ?? ((edge: Edge, id: string) => inferEdgeSide(edge, id, nodePositions));

  // Only use per-edge bidirectional lane when the side contains *only* that
  // pair. If the side also has other edges (e.g. Client right has 2 outgoing
  // + 1 incoming), the handle can only render one offset per type, so the
  // edge must use the side's averaged slot to stay aligned with the handle.
  const bidirectionalLane = getBidirectionalLaneOffset(self, nodeId, edges, nodePositions);
  if (bidirectionalLane !== null) {
    let countOnSide = 0;
    let hasOther = false;
    const otherId = self.source === nodeId ? self.target : self.source;
    for (const e of edges) {
      if (e.source !== nodeId && e.target !== nodeId) continue;
      const s = effectiveResolveSide(e, nodeId);
      if (s !== side) continue;
      countOnSide++;
      const o = e.source === nodeId ? e.target : e.source;
      if (o !== otherId) hasOther = true;
    }
    if (countOnSide === 2 && !hasOther) return bidirectionalLane;
  }

  if (!hasBothDirectionsOnSide(nodeId, side, edges, effectiveResolveSide as EdgeSideResolver)) return 0;

  const { incomingOffset, outgoingOffset } = computeDynamicSlotOffsets(
    nodeId, side, edges, nodePositions, effectiveResolveSide,
  );

  const isIncoming = self.target === nodeId;
  return isIncoming ? incomingOffset : outgoingOffset;
}

/**
 * Computes an anchor point 12px outside the node boundary for a given side.
 * The edge terminates at the handle center (handle sticks out 12px) so the
 * arrow tip feels connected to the handle donut.
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
    default:
      return { x: nodeX + width / 2, y: nodeY + height / 2 };
  }
}
