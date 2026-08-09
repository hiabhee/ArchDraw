import type { RFNode } from './types'
import { SUBGRAPH_PADDING } from './types'
import { isTextNode } from './textNodes'

interface ParentUpdate {
  position: { x: number; y: number }
  width: number
  height: number
}

export function sizeSubgraphs(nodes: RFNode[]): RFNode[] {
  const groupIds = new Set(nodes.filter(n => n.type === 'groupNode').map(n => n.id))

  const childIdsByParent = new Map<string, string[]>()
  const boundChildIdsByParent = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentNode && groupIds.has(node.parentNode)) {
      if (!childIdsByParent.has(node.parentNode)) {
        childIdsByParent.set(node.parentNode, [])
      }
      childIdsByParent.get(node.parentNode)!.push(node.id)
      // Free-text / annotation nodes are placed after layout and must not
      // inflate the group bounding box.
      if (!isTextNode(node)) {
        if (!boundChildIdsByParent.has(node.parentNode)) {
          boundChildIdsByParent.set(node.parentNode, [])
        }
        boundChildIdsByParent.get(node.parentNode)!.push(node.id)
      }
    }
  }

  // Compute bounding box of children (using absolute positions) and derive new parent bounds
  const parentUpdates = new Map<string, ParentUpdate>()
  for (const [parentId, childIds] of boundChildIdsByParent) {
    // Fall back to all children (incl. text) when a group only contains text.
    const boundIds = childIds.length > 0 ? childIds : (childIdsByParent.get(parentId) ?? [])
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const childId of boundIds) {
      const child = nodes.find(n => n.id === childId)
      if (!child) continue
      const cx = child.position.x
      const cy = child.position.y
      const cw = child.width ?? 0
      const ch = child.height ?? 0
      if (cx < minX) minX = cx
      if (cy < minY) minY = cy
      if (cx + cw > maxX) maxX = cx + cw
      if (cy + ch > maxY) maxY = cy + ch
    }
    if (minX === Infinity) continue

    const pad = SUBGRAPH_PADDING
    const labelPad = 64
    const newWidth = maxX - minX + pad * 2
    const newHeight = maxY - minY + pad + labelPad
    const newX = minX - pad
    const newY = minY - labelPad

    parentUpdates.set(parentId, {
      position: { x: newX, y: newY },
      width: newWidth,
      height: newHeight,
    })
  }

  return nodes.map(node => {
    // Children: make position relative to parent's NEW position
    if (node.parentNode && parentUpdates.has(node.parentNode)) {
      const pu = parentUpdates.get(node.parentNode)!
      return {
        ...node,
        position: {
          x: node.position.x - pu.position.x,
          y: node.position.y - pu.position.y,
        },
      }
    }
    // Group nodes: apply new bounds
    if (parentUpdates.has(node.id)) {
      const pu = parentUpdates.get(node.id)!
      return {
        ...node,
        position: { x: pu.position.x, y: pu.position.y },
        width: pu.width,
        height: pu.height,
        style: {
          ...(node.style as Record<string, unknown> || {}),
          width: pu.width,
          height: pu.height,
        },
      }
    }
    return node
  })
}
