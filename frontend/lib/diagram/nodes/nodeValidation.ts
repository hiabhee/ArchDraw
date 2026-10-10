import logger from '@/lib/logger';
import type { Node } from 'reactflow';

export const sortNodesWithParentsFirst = (nodes: Node[]): Node[] => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sorted: Node[] = [];
  const visited = new Set<string>();

  const visit = (node: Node) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const parentId = node.parentId || (node as Node & { parentNode?: string }).parentNode;
    if (parentId && nodeMap.has(parentId)) {
      const parent = nodeMap.get(parentId)!;
      visit(parent);
    }

    sorted.push(node);
  };

  nodes.forEach(visit);
  return sorted;
};

export const cleanOrphanedChildren = (nodes: Node[]): Node[] => {
  const allNodeIds = new Set(nodes.map(n => n.id));

  let hasChanges = false;
  const cleaned = nodes.map(node => {
    const parentId = node.parentId || (node as Node & { parentNode?: string }).parentNode;
    if (parentId && !allNodeIds.has(parentId)) {
      logger.warn(`Cleaning orphaned child ${node.id}: parent ${parentId} not found`);
      hasChanges = true;
      const { parentNode: _p, parentId: __p, extent: _e, ...rest } = node as Node & { parentNode?: string, parentId?: string };
      return rest as Node;
    }
    return node;
  });

  return hasChanges ? cleaned : nodes;
};

export const validateAndFixNodes = (nodes: Node[]): Node[] => {
  let fixed = cleanOrphanedChildren(nodes);
  fixed = sortNodesWithParentsFirst(fixed);
  return fixed;
};