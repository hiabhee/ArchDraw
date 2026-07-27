import dagre from 'dagre'
import type { RFObjects, RFNode, Direction } from './types'
import { NODE_WIDTH, NODE_HEIGHT, SUBGRAPH_PADDING } from './types'
import { MIN_HORIZONTAL_SPACING, MIN_VERTICAL_SPACING } from '@/lib/config'

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
  g.setGraph({
    rankdir: mapDirection(direction),
    nodesep: isVertical ? MIN_HORIZONTAL_SPACING : MIN_VERTICAL_SPACING,
    ranksep: isVertical ? MIN_VERTICAL_SPACING : MIN_HORIZONTAL_SPACING,
    marginx: 40,
    marginy: 40,
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

  const layoutedNodes: RFNode[] = objects.nodes.map(node => {
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

  return { nodes: layoutedNodes, edges: [...objects.edges] }
}
