import type { CSSProperties } from 'react'

export interface SubgraphBoundsNode {
  id: string
  parentNode?: string
  position: { x: number; y: number }
  width: number
  height: number
  absX: number
  absY: number
  isGroup: boolean
  data?: Record<string, unknown>
  style?: CSSProperties
}

const SUBGRAPH_PADDING = 40
const LABEL_PAD = 64

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.startsWith('#') ? hex : '#2563EB'
  const r = parseInt(cleanHex.slice(1, 3), 16) || 37
  const g = parseInt(cleanHex.slice(3, 5), 16) || 99
  const b = parseInt(cleanHex.slice(5, 7), 16) || 235
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Recomputes group-node bounds from their (possibly user-preserved) child
 * positions, mutating the passed nodes in place.
 *
 * Nested groups are processed innermost-first so an outer group's box wraps
 * ALL of its direct children — leaf nodes AND nested group nodes. Without this,
 * an outer group is only sized around its direct leaf children and the nested
 * groups end up overlapping/overflowing it.
 *
 * Groups without children are left untouched (their `absX`/`absY` are synced to
 * `position` so a parent's bounds computation still sees a consistent box).
 */
export function recomputeSubgraphBounds(nodes: SubgraphBoundsNode[]): SubgraphBoundsNode[] {
  const groups = new Map<string, SubgraphBoundsNode>()
  const leaves = new Map<string, SubgraphBoundsNode>()
  for (const node of nodes) {
    if (node.isGroup) groups.set(node.id, node)
    else leaves.set(node.id, node)
  }

  const childIdsByParent = new Map<string, string[]>()
  const addChild = (node: SubgraphBoundsNode) => {
    if (node.parentNode && groups.has(node.parentNode)) {
      if (!childIdsByParent.has(node.parentNode)) {
        childIdsByParent.set(node.parentNode, [])
      }
      childIdsByParent.get(node.parentNode)!.push(node.id)
    }
  }
  leaves.forEach(addChild)
  groups.forEach(addChild)

  const depthOf = (id: string, seen = new Set<string>()): number => {
    const sub = groups.get(id)
    if (!sub || seen.has(id)) return 0
    if (!sub.parentNode || !groups.has(sub.parentNode)) return 0
    seen.add(id)
    return 1 + depthOf(sub.parentNode, seen)
  }

  const ordered = Array.from(groups.entries()).sort((a, b) => depthOf(b[0]) - depthOf(a[0]))

  for (const [groupId, group] of ordered) {
    const childIds = childIdsByParent.get(groupId) || []
    if (childIds.length === 0) {
      group.absX = group.position.x
      group.absY = group.position.y
      continue
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const childId of childIds) {
      const child = leaves.get(childId) || groups.get(childId)
      if (!child) continue
      const cw = child.width ?? 0
      const ch = child.height ?? 0
      if (child.absX < minX) minX = child.absX
      if (child.absY < minY) minY = child.absY
      if (child.absX + cw > maxX) maxX = child.absX + cw
      if (child.absY + ch > maxY) maxY = child.absY + ch
    }
    if (minX === Infinity) continue

    const newWidth = maxX - minX + SUBGRAPH_PADDING * 2
    const newHeight = maxY - minY + SUBGRAPH_PADDING + LABEL_PAD
    const newX = minX - SUBGRAPH_PADDING
    const newY = minY - LABEL_PAD

    group.position = { x: newX, y: newY }
    group.absX = newX
    group.absY = newY
    group.width = newWidth
    group.height = newHeight

    const groupColor = (group.data?.color as string) || (group.data?.groupColor as string) || '#2563EB'
    group.style = {
      ...(group.style || {}),
      width: newWidth,
      height: newHeight,
      backgroundColor: hexToRgba(groupColor, 0.08),
      borderColor: groupColor,
      borderRadius: '12px',
    }

    for (const childId of childIds) {
      const child = leaves.get(childId) || groups.get(childId)
      if (!child) continue
      child.position = { x: child.absX - newX, y: child.absY - newY }
    }
  }

  return nodes
}
