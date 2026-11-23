import type { Node } from 'reactflow';
import { NODE_WIDTH, NODE_HEIGHT, getConcernColor } from '@/lib/theme/stylingConstants';
import { hexToRgba } from './svgPrimitives';

function parentIdOf(node: Node) {
  return node.parentNode ?? (node as Node & { parentId?: string }).parentId;
}

export function resolveAbsolutePosition(node: Node, nodeMap: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = parentIdOf(node);
  const seen = new Set([node.id]);
  while (parentId && !seen.has(parentId)) {
    const parent = nodeMap.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    seen.add(parentId);
    parentId = parentIdOf(parent);
  }
  return { x, y };
}

export function nodeDepth(node: Node, nodeMap: Map<string, Node>): number {
  let depth = 0;
  let parentId = parentIdOf(node);
  const seen = new Set([node.id]);
  while (parentId && nodeMap.has(parentId) && !seen.has(parentId)) {
    depth += 1;
    seen.add(parentId);
    parentId = parentIdOf(nodeMap.get(parentId)!);
  }
  return depth;
}

export function getTierColorNormalized(layer?: string): string {
  return getConcernColor(layer);
}

export function getDarkCategoryStyle(layer?: string): { border: string; glow: string } {
  const color = getTierColorNormalized(layer);
  return { border: color, glow: hexToRgba(color, 0.12) };
}

export function calculateBounds(nodes: Node[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.width ?? node.data?.nodeWidth ?? NODE_WIDTH;
    const height = node.height ?? node.data?.nodeHeight ?? NODE_HEIGHT;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  const padding = 50;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/** `bounds` grown to hold `points`, with `margin` px of room beyond the outermost one. */
export function extendBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  points: ReadonlyArray<{ x: number; y: number }>,
  margin: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let { minX, minY, maxX, maxY } = bounds;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x - margin);
    minY = Math.min(minY, point.y - margin);
    maxX = Math.max(maxX, point.x + margin);
    maxY = Math.max(maxY, point.y + margin);
  }
  return { minX, minY, maxX, maxY };
}
