import { Edge, Node, Position } from 'reactflow';
import { getDynamicHandles, getObstacleAwareHandles } from '@/lib/features/dynamicHandles';
import type { NodeRect } from '@/lib/features/dynamicHandles';

export interface EdgePositions {
  sourcePos: Position;
  targetPos: Position;
}

// Align with FloatingHandles.tsx defaults for accurate edge attachment
const HANDLE_OFFSETS = {
  [Position.Left]: 0,
  [Position.Right]: 0,
  [Position.Top]: 0,
  [Position.Bottom]: 0,
};

export function getNodeCenter(node: Node) {
  const x = node.positionAbsolute?.x ?? node.position.x;
  const y = node.positionAbsolute?.y ?? node.position.y;
  const width = node.width ?? 160;
  const height = node.height ?? 80;
  return { cx: x + width / 2, cy: y + height / 2, x, y, width, height };
}

export function getSimpleEdgePositions(
  sourceX: number,
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

export function getEdgeShiftOffset(
  nodeId: string,
  edgeId: string,
  side: Position,
  edges: Edge[],
  nodeInternals: Map<string, Node>,
  spacing: number = 15,
  allNodeRects?: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
  excludedNodeIds?: Set<string>,
): number {
  const node = nodeInternals.get(nodeId);
  if (!node) return 0;

  const currentEdge = (edges || []).find(e => e.id === edgeId);
  const isSource = currentEdge?.source === nodeId;


  
  // Find all edges that connect to this node on the given side
  const connectedEdges = (edges || []).map(e => {
    if (e.source !== nodeId && e.target !== nodeId) return null;
    
    const sNode = nodeInternals.get(e.source);
    const tNode = nodeInternals.get(e.target);
    if (!sNode || !tNode) return null;
    
    const sRect: NodeRect = {
      x: sNode.positionAbsolute?.x ?? sNode.position.x,
      y: sNode.positionAbsolute?.y ?? sNode.position.y,
      width: sNode.width ?? 160,
      height: sNode.height ?? 80,
    };
    const tRect: NodeRect = {
      x: tNode.positionAbsolute?.x ?? tNode.position.x,
      y: tNode.positionAbsolute?.y ?? tNode.position.y,
      width: tNode.width ?? 160,
      height: tNode.height ?? 80,
    };
    const sCenter = getNodeCenter(sNode);
    const tCenter = getNodeCenter(tNode);
    
    // Use the same handle-selection logic as SimpleFloatingEdge (getObstacleAwareHandles
    // wraps getDynamicHandles) to ensure offset calculations stay in sync with
    // the actual handle positions rendered on the canvas.
    const { sourcePosition, targetPosition } = allNodeRects
      ? getObstacleAwareHandles(sRect, tRect, allNodeRects, excludedNodeIds, e.id, e.source, e.target)
      : getDynamicHandles(sRect, tRect);
    
    if (e.source === nodeId && sourcePosition === side) {
      return { edge: e, otherNodeCenter: tCenter };
    }
    if (e.target === nodeId && targetPosition === side) {
      return { edge: e, otherNodeCenter: sCenter };
    }
    
    return null;
  }).filter(Boolean) as { edge: Edge; otherNodeCenter: ReturnType<typeof getNodeCenter> }[];
  
  const totalNodeEdges = (edges || []).filter(e => e.source === nodeId || e.target === nodeId).length;
  if (totalNodeEdges <= 1) return 0;

  const idx = connectedEdges.findIndex(e => e.edge.id === edgeId);
  if (idx === -1) return 0;

  return (idx - (connectedEdges.length - 1) / 2) * 15;
}

export function getSimpleHandlePosition(
  nodeX: number,
  nodeY: number,
  width: number,
  height: number,
  position: Position,
  shiftOffset: number = 0
): { x: number; y: number } {
  const offset = HANDLE_OFFSETS[position] || 0;
  const outerOffset = 12;

  switch (position) {
    case Position.Left:
      return { x: nodeX - outerOffset + offset, y: nodeY + height / 2 + shiftOffset };
    case Position.Right:
      return { x: nodeX + width + outerOffset + offset, y: nodeY + height / 2 + shiftOffset };
    case Position.Top:
      return { x: nodeX + width / 2 + shiftOffset, y: nodeY - outerOffset + offset };
    case Position.Bottom:
      return { x: nodeX + width / 2 + shiftOffset, y: nodeY + height + outerOffset + offset };
  }
}

export function getHandleOffset(position: Position): number {
  return HANDLE_OFFSETS[position] || 0;
}
