import dagre from 'dagre';
import { Node, Edge } from 'reactflow';
import logger from './logger';
import { calculateNodeDimensions } from './utils/nodeSizing';
import { getTierForCategory } from './nodeShapes';

function wouldCreateCycle(childId: string, parentId: string, parentMap: Map<string, string>): boolean {
  if (childId === parentId) return true;
  let current = parentId;
  const visited = new Set<string>([childId, parentId]);
  while (parentMap.has(current)) {
    const next = parentMap.get(current)!;
    if (visited.has(next)) return true;
    visited.add(next);
    current = next;
  }
  return false;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
  spacing?: { ranksep?: number; nodesep?: number }
): { nodes: Node[]; edges: Edge[] } {
  const hasAuthoredPositions = nodes.some((node) => node.position.x !== 0 || node.position.y !== 0);

  if (hasAuthoredPositions) {
    return { nodes, edges };
  }

  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: spacing?.ranksep ?? 200,
    nodesep: spacing?.nodesep ?? 120,
    align: 'DL',
  });

  const groupNodeIds = new Set(
    nodes
      .filter((n) => n.type === 'group' || n.type === 'groupNode' || n.data?.isGroup)
      .map((n) => n.id)
  );

  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (node.parentId && groupNodeIds.has(node.parentId)) {
      if (!wouldCreateCycle(node.id, node.parentId, parentMap)) {
        parentMap.set(node.id, node.parentId);
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        childrenMap.get(node.parentId)!.push(node.id);
      } else {
        node.parentId = undefined;
      }
    }
  });

  const SUBGRAPH_PADDING = 40;

  nodes.forEach((node) => {
    const isGroup = groupNodeIds.has(node.id);
    if (isGroup) {
      const hasChildren = (childrenMap.get(node.id)?.length ?? 0) > 0;
      if (hasChildren) {
        dagreGraph.setNode(node.id, {
          paddingLeft: SUBGRAPH_PADDING,
          paddingRight: SUBGRAPH_PADDING,
          paddingTop: 64, // Extra padding above the top bun (header)
          paddingBottom: SUBGRAPH_PADDING,
        });
      } else {
        dagreGraph.setNode(node.id, {
          width: 200,
          height: 150,
        });
      }
    } else {
      const { label, subtitle, category } = node.data || {};
      const { width, height } = calculateNodeDimensions(label || '', subtitle);
      const tier = getTierForCategory(category || '');

      dagreGraph.setNode(node.id, { 
        width, 
        height,
        rank: tier
      });
    }

    if (node.parentId && groupNodeIds.has(node.parentId)) {
      dagreGraph.setParent(node.id, node.parentId);
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  try {
    dagre.layout(dagreGraph);
  } catch (e) {
    logger.error('[Layout] Dagre layout failed:', e);
    return { nodes, edges };
  }

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = dagreGraph.node(node.id);
    if (!dagreNode) return node;
    const { x, y, width, height } = dagreNode;
    
    const absoluteX = Math.round((x - width / 2) / 20) * 20;
    const absoluteY = Math.round((y - height / 2) / 20) * 20;

    const updatedNode = {
      ...node,
      width,
      height,
      position: {
        x: absoluteX,
        y: absoluteY,
      },
      data: {
        ...node.data,
        nodeWidth: width,
        nodeHeight: height,
      }
    };

    if (groupNodeIds.has(node.id)) {
      updatedNode.style = {
        ...node.style,
        width,
        height,
      };
    }

    return updatedNode;
  });

  // Convert children to parent-relative and snap them to grid
  const finalNodes = layoutedNodes.map((node) => {
    if (node.parentId) {
      const parent = layoutedNodes.find((p) => p.id === node.parentId);
      if (parent) {
        return {
          ...node,
          position: {
            x: Math.round((node.position.x - parent.position.x) / 20) * 20,
            y: Math.round((node.position.y - parent.position.y) / 20) * 20,
          },
        };
      }
    }
    return node;
  });

  return { nodes: finalNodes, edges };
}
