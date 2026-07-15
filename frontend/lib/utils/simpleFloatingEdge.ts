import { Edge, Node, Position } from 'reactflow';

export interface EdgePositions {
  sourcePos: Position;
  targetPos: Position;
}

type HandleType = 'source' | 'target';

const EDGE_ENDPOINT_GAP = 0;

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
  ...args: [
    nodeId: string,
    edgeId: string,
    side: Position,
    edges: Edge[],
    nodeInternals: Map<string, Node>,
    spacing?: number,
    allNodeRects?: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
    excludedNodeIds?: Set<string>,
  ]
): number {
  void args;
  return 0;
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
