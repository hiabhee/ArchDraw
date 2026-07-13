import type { Node } from 'reactflow';
import logger from '@/lib/logger';

interface FlowNode extends Node {
  dragging?: boolean;
  measured?: {
    width?: number;
    height?: number;
  };
}

export function resolveNodeCollisions(nodes: Node[], margin: number = 50): Node[] {
  if (!nodes || !Array.isArray(nodes)) {
    logger.warn('[Collision] resolveNodeCollisions received invalid nodes parameter:', nodes);
    return [];
  }

  if (nodes.length > 50) {
    logger.warn('[Collision] Skipping collision resolve - too many nodes');
    return nodes;
  }

  const clonedNodes = nodes.map((n) => ({
    ...n,
    position: { ...n.position },
  })) as FlowNode[];

  let overlapFound = true;
  let iterations = 0;
  const maxIterations = 100;

  while (overlapFound && iterations < maxIterations) {
    overlapFound = false;
    iterations++;

    for (let i = 0; i < clonedNodes.length; i++) {
      for (let j = i + 1; j < clonedNodes.length; j++) {
        const A = clonedNodes[i];
        const B = clonedNodes[j];

        if (A.dragging || B.dragging) {
          continue;
        }

        const aParent = A.parentId || (A as unknown as { parentNode?: string }).parentNode;
        const bParent = B.parentId || (B as unknown as { parentNode?: string }).parentNode;
        if (aParent || bParent) {
          continue;
        }

        const aWidth = A.measured?.width ?? A.width ?? 150;
        const aHeight = A.measured?.height ?? A.height ?? 50;
        const bWidth = B.measured?.width ?? B.width ?? 150;
        const bHeight = B.measured?.height ?? B.height ?? 50;

        const aLeft = A.position.x - margin / 2;
        const aRight = A.position.x + aWidth + margin / 2;
        const aTop = A.position.y - margin / 2;
        const aBottom = A.position.y + aHeight + margin / 2;

        const bLeft = B.position.x - margin / 2;
        const bRight = B.position.x + bWidth + margin / 2;
        const bTop = B.position.y - margin / 2;
        const bBottom = B.position.y + bHeight + margin / 2;

        const isOverlapping = !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);

        if (isOverlapping) {
          overlapFound = true;
          const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
          const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);

          if (overlapX < overlapY) {
            const moveX = overlapX / 2 + 1;
            if (A.position.x < B.position.x) {
              A.position.x -= moveX;
              B.position.x += moveX;
            } else {
              A.position.x += moveX;
              B.position.x -= moveX;
            }
          } else {
            const moveY = overlapY / 2 + 1;
            if (A.position.y < B.position.y) {
              A.position.y -= moveY;
              B.position.y += moveY;
            } else {
              A.position.y += moveY;
              B.position.y -= moveY;
            }
          }
        }
      }
    }
  }

  return clonedNodes;
}
