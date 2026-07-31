import * as dagre from 'dagre'
import type { RFObjects, RFNode, Direction } from './types'
import { NODE_WIDTH, NODE_HEIGHT, SUBGRAPH_PADDING } from './types'

// Use local constants to avoid import issues
const MIN_HORIZONTAL_SPACING = 100; // Further increased for guaranteed edge visibility
const MIN_VERTICAL_SPACING = 150; // Further increased for guaranteed edge visibility

function mapDirection(d: Direction): string {
  const map: Record<string, string> = { TD: 'TB', LR: 'LR', BT: 'BT', RL: 'RL' }
  return map[d] ?? 'TB'
}

function wouldCreateCycle(childId: string, parentId: string, parentMap: Map<string, string>): boolean {
  if (childId === parentId) return true
  let current = parentId
  const visited = new Set<string>([childId, parentId])
  while (parentMap.has(current)) {
    const next = parentMap.get(current)!
    if (visited.has(next)) return true
    visited.add(next)
    current = next
  }
  return false
}

export function applyLayout(objects: RFObjects, direction: Direction): RFObjects {
  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))

  const isVertical = direction === 'TD' || direction === 'BT';
  
  // Use tighter spacing for better compact layouts
  const nodesep = isVertical ? MIN_HORIZONTAL_SPACING : MIN_VERTICAL_SPACING;
  const ranksep = isVertical ? MIN_VERTICAL_SPACING : MIN_HORIZONTAL_SPACING;
  
  g.setGraph({
    rankdir: mapDirection(direction),
    nodesep,
    ranksep,
    marginx: 30,
    marginy: 30,
  })

  const subgraphIds = new Set(
    objects.nodes.filter(n => n.type === 'groupNode').map(n => n.id)
  )

  // Map to store children for each subgraph, with cycle prevention
  const parentMap = new Map<string, string>()
  const childrenMap = new Map<string, string[]>()
  for (const node of objects.nodes) {
    if (node.parentNode && subgraphIds.has(node.parentNode)) {
      if (!wouldCreateCycle(node.id, node.parentNode, parentMap)) {
        parentMap.set(node.id, node.parentNode)
        if (!childrenMap.has(node.parentNode)) {
          childrenMap.set(node.parentNode, [])
        }
        childrenMap.get(node.parentNode)!.push(node.id)
      } else {
        node.parentNode = undefined
      }
    }
  }

  // Add all nodes to dagre
  for (const node of objects.nodes) {
    const isSubgraph = subgraphIds.has(node.id)
    if (isSubgraph) {
      const hasChildren = (childrenMap.get(node.id)?.length ?? 0) > 0
      if (hasChildren) {
        g.setNode(node.id, {
          paddingLeft: SUBGRAPH_PADDING,
          paddingRight: SUBGRAPH_PADDING,
          paddingTop: 64, // Extra padding above the top bun (header)
          paddingBottom: SUBGRAPH_PADDING,
        })
      } else {
        // Subgraph with no children: set a default size
        g.setNode(node.id, {
          width: NODE_WIDTH + SUBGRAPH_PADDING * 2,
          height: NODE_HEIGHT + 64 + SUBGRAPH_PADDING,
        })
      }
    } else {
      g.setNode(node.id, {
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? NODE_HEIGHT,
      })
    }

    if (node.parentNode && subgraphIds.has(node.parentNode)) {
      g.setParent(node.id, node.parentNode)
    }
  }

  // Add all edges
  for (const edge of objects.edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  let layoutedNodes: RFNode[] = objects.nodes.map(node => {
    const dagreNode = g.node(node.id)
    if (!dagreNode) return { ...node }

    const { x, y, width, height } = dagreNode
    const nodeX = x - width / 2
    const nodeY = y - height / 2

    return {
      ...node,
      position: { x: nodeX, y: nodeY },
      width,
      height,
      style: node.type === 'groupNode'
        ? { ...node.style as Record<string, unknown>, width, height }
        : node.style,
    }
  })

  // Anti-clustering: resolve overlapping nodes with optimized spacing
  const minSpacing = 30; // Base minimum spacing
  const connectedNodeSpacing = 50; // Base spacing for connected nodes
  
  // Build a set of connected node pairs for special spacing
  const connectedPairs = new Set<string>();
  objects.edges.forEach(edge => {
    const pairKey = [edge.source, edge.target].sort().join('-');
    connectedPairs.add(pairKey);
  });
  
  // Single iteration for performance
  for (let i = 0; i < layoutedNodes.length; i++) {
    for (let j = i + 1; j < layoutedNodes.length; j++) {
      const nodeA = layoutedNodes[i];
      const nodeB = layoutedNodes[j];
      
      // Skip if they're in different parent groups
      if (nodeA.parentNode !== nodeB.parentNode) continue;
      
      const dx = nodeB.position.x - nodeA.position.x;
      const dy = nodeB.position.y - nodeA.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if these nodes are connected
      const pairKey = [nodeA.id, nodeB.id].sort().join('-');
      const isConnected = connectedPairs.has(pairKey);
      
      // Use larger spacing for connected nodes
      const spacing = isConnected ? connectedNodeSpacing : minSpacing;
      const minDistance = ((nodeA.width || NODE_WIDTH) + (nodeB.width || NODE_WIDTH)) / 2 + spacing;
      
      if (distance < minDistance && distance > 0) {
        // Push nodes apart
        const overlap = minDistance - distance;
        const pushX = (dx / distance) * overlap * 0.5;
        const pushY = (dy / distance) * overlap * 0.5;
        
        layoutedNodes[j] = { 
          ...nodeB, 
          position: { x: nodeB.position.x + pushX, y: nodeB.position.y + pushY } 
        };
        layoutedNodes[i] = { 
          ...nodeA, 
          position: { x: nodeA.position.x - pushX, y: nodeA.position.y - pushY } 
        };
      }
    }
  }

  return { nodes: layoutedNodes, edges: [...objects.edges] }
}
