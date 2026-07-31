import * as dagre from 'dagre';
import type { LayoutEngine, LayoutParams, LayoutResult, PositionedNode, PositionedEdge, LayoutDirection, LayoutNode, LayoutEdge } from './LayoutEngine';

function toDagreRankDir(direction: LayoutDirection): string {
  const map: Record<LayoutDirection, string> = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
  return map[direction] ?? 'TB';
}

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

export class DagreLayoutEngine implements LayoutEngine {
  readonly name = 'dagre';

  isAvailable(): boolean {
    return typeof dagre === 'object' && dagre !== null;
  }

  async layout(params: LayoutParams): Promise<LayoutResult> {
    const warnings: string[] = [];
    const g = new dagre.graphlib.Graph({ compound: true });
    g.setDefaultEdgeLabel(() => ({}));
    
    // Use tighter spacing for better compact layouts
    const isVertical = params.direction === 'TB' || params.direction === 'BT';
    const nodesep = params.options?.nodeSep ?? (isVertical ? 100 : 120); // Further increased for guaranteed edge visibility
    const ranksep = params.options?.rankSep ?? (isVertical ? 150 : 180); // Further increased for guaranteed edge visibility
    
    g.setGraph({
      rankdir: toDagreRankDir(params.direction),
      nodesep,
      ranksep,
      marginx: params.options?.marginX ?? 30,
      marginy: params.options?.marginY ?? 30,
    });

    const subgraphIds = new Set(params.nodes.filter(n => n.isGroup).map(n => n.id));

    const parentMap = new Map<string, string>();
    const cycledNodes = new Set<string>();
    for (const node of params.nodes) {
      if (node.parentId && subgraphIds.has(node.parentId)) {
        if (!wouldCreateCycle(node.id, node.parentId, parentMap)) {
          parentMap.set(node.id, node.parentId);
        } else {
          warnings.push(`Cycle detected: node "${node.id}" parent "${node.parentId}" — removed parent reference`);
          cycledNodes.add(node.id);
        }
      }
    }

    for (const node of params.nodes) {
      const isSubgraph = subgraphIds.has(node.id);
      if (isSubgraph) {
        const hasChildren = params.nodes.some(n => parentMap.get(n.id) === node.id);
        if (hasChildren) {
          g.setNode(node.id, {
            paddingLeft: params.options?.paddingLeft ?? 40,
            paddingRight: params.options?.paddingRight ?? 40,
            paddingTop: params.options?.paddingTop ?? 64,
            paddingBottom: params.options?.paddingBottom ?? 40,
          });
        } else {
          g.setNode(node.id, {
            width: (node.width || 180) + (params.options?.paddingLeft ?? 40) * 2,
            height: (node.height || 60) + (params.options?.paddingTop ?? 64) + (params.options?.paddingBottom ?? 40),
          });
        }
      } else {
        g.setNode(node.id, {
          width: node.width || 180,
          height: node.height || 60,
        });
      }

      const resolvedParentId = cycledNodes.has(node.id) ? undefined : parentMap.get(node.id);
      if (resolvedParentId && subgraphIds.has(resolvedParentId)) {
        g.setParent(node.id, resolvedParentId);
      }
    }

    for (const edge of params.edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    // Apply anti-clustering: ensure minimum spacing between nodes
    let positionedNodes: PositionedNode[] = params.nodes.map(node => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) {
        warnings.push(`Node "${node.id}" not positioned by dagre`);
        return { ...node, x: 0, y: 0 };
      }
      const x = dagreNode.x - (dagreNode.width || node.width) / 2;
      const y = dagreNode.y - (dagreNode.height || node.height) / 2;
      return {
        ...node,
        x,
        y,
        width: dagreNode.width || node.width,
        height: dagreNode.height || node.height,
      };
    });

    // Anti-clustering: resolve overlapping nodes with optimized spacing
    const minSpacing = 30; // Base minimum spacing
    const connectedNodeSpacing = 50; // Base spacing for connected nodes
    
    // Build a set of connected node pairs for special spacing
    const connectedPairs = new Set<string>();
    params.edges.forEach(edge => {
      const pairKey = [edge.source, edge.target].sort().join('-');
      connectedPairs.add(pairKey);
    });
    
    // Single iteration for performance
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];
        
        // Skip if they're in different parent groups
        if (nodeA.parentId !== nodeB.parentId) continue;
        
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if these nodes are connected
        const pairKey = [nodeA.id, nodeB.id].sort().join('-');
        const isConnected = connectedPairs.has(pairKey);
        
        // Use larger spacing for connected nodes
        const spacing = isConnected ? connectedNodeSpacing : minSpacing;
        const minDistance = (nodeA.width + nodeB.width) / 2 + spacing;
        
        if (distance < minDistance && distance > 0) {
          // Push nodes apart
          const overlap = minDistance - distance;
          const pushX = (dx / distance) * overlap * 0.5;
          const pushY = (dy / distance) * overlap * 0.5;
          
          positionedNodes[j] = { ...nodeB, x: nodeB.x + pushX, y: nodeB.y + pushY };
          positionedNodes[i] = { ...nodeA, x: nodeA.x - pushX, y: nodeA.y - pushY };
        }
      }
    }

    const positionedEdges: PositionedEdge[] = params.edges.map(edge => {
      const dagreEdge = g.edge(edge.source, edge.target);
      return {
        ...edge,
        points: dagreEdge?.points?.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      };
    });

    return { nodes: positionedNodes, edges: positionedEdges, warnings };
  }
}
