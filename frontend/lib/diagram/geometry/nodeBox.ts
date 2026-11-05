/**
 * One definition of a node's size and centre, shared by alignment snapping,
 * the drop-time straighten, the load-time straighten and edge alignment.
 * Each of those used to pick its own fallback size (88px or 100px) and read
 * sizes in a different order, so the same node got different centres and
 * each step nudged it again.
 */

/** Used only when a node carries no size at all. Matches nodeSizing's default. */
export const NODE_FALLBACK_WIDTH = 200;
export const NODE_FALLBACK_HEIGHT = 100;

interface SizedNode {
  width?: number | null;
  height?: number | null;
  data?: unknown;
  style?: unknown;
}

interface PositionedNode extends SizedNode {
  position: { x: number; y: number };
  positionAbsolute?: { x: number; y: number };
}

/**
 * Size a node is drawn at: the measured size React Flow stores on the node,
 * else the size the factory wrote into `data`, else the style, else the fallback.
 */
export function nodeSize(node: SizedNode): { width: number; height: number } {
  const data = (node.data ?? {}) as { nodeWidth?: number; nodeHeight?: number };
  const style = (node.style ?? {}) as { width?: number; height?: number };
  return {
    width: node.width ?? data.nodeWidth ?? style.width ?? NODE_FALLBACK_WIDTH,
    height: node.height ?? data.nodeHeight ?? style.height ?? NODE_FALLBACK_HEIGHT,
  };
}

/** Absolute top-left corner. Child positions are relative to their group, so prefer React Flow's absolute value. */
export function nodeTopLeft(node: PositionedNode): { x: number; y: number } {
  return node.positionAbsolute ?? node.position;
}

/** Absolute centre of the drawn node. */
export function nodeCentre(node: PositionedNode): { x: number; y: number } {
  const { x, y } = nodeTopLeft(node);
  const { width, height } = nodeSize(node);
  return { x: x + width / 2, y: y + height / 2 };
}
