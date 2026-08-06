import { type Connection, type Node, Position } from 'reactflow';
import { facingSideToward, type HandlerRect } from '@/lib/utils/handlerPairScorer';

function nodeToRect(node: Node): HandlerRect {
  const x = node.positionAbsolute?.x ?? node.position.x;
  const y = node.positionAbsolute?.y ?? node.position.y;
  const data = node.data as { nodeWidth?: number; nodeHeight?: number } | undefined;
  return {
    x,
    y,
    width: node.width ?? data?.nodeWidth ?? 200,
    height: node.height ?? data?.nodeHeight ?? 80,
  };
}

function sideToSuffix(side: Position): string {
  switch (side) {
    case Position.Left:
      return 'left';
    case Position.Right:
      return 'right';
    case Position.Top:
      return 'top';
    case Position.Bottom:
      return 'bottom';
    default:
      return 'right';
  }
}

/**
 * Build a connection when the user drops a drag line on another node's body
 * (not directly on a handle). Picks facing sides so the edge attaches cleanly.
 */
export function resolveNodeDropConnection(params: {
  nodes: Node[];
  originNodeId: string;
  originHandleType: 'source' | 'target' | null;
  originHandleId: string | null;
  targetNodeId: string;
}): Connection | null {
  const { nodes, originNodeId, originHandleType, originHandleId, targetNodeId } = params;
  if (!originHandleType || originNodeId === targetNodeId) return null;

  const origin = nodes.find((n) => n.id === originNodeId);
  const target = nodes.find((n) => n.id === targetNodeId);
  if (!origin || !target) return null;

  const originRect = nodeToRect(origin);
  const targetRect = nodeToRect(target);
  const targetFacingSide = facingSideToward(targetRect, originRect);
  const originFacingSide = facingSideToward(originRect, targetRect);

  const originHandle =
    originHandleId && originHandleId.startsWith(`${originHandleType}-`)
      ? originHandleId
      : `${originHandleType}-${sideToSuffix(originFacingSide)}`;

  if (originHandleType === 'source') {
    return {
      source: originNodeId,
      sourceHandle: originHandle,
      target: targetNodeId,
      targetHandle: `target-${sideToSuffix(targetFacingSide)}`,
    };
  }

  return {
    source: targetNodeId,
    sourceHandle: `source-${sideToSuffix(targetFacingSide)}`,
    target: originNodeId,
    targetHandle: originHandle,
  };
}
