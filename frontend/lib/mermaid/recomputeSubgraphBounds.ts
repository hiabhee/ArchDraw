import type { CSSProperties } from 'react'
import { isTextNode } from './textNodes'
import {
  SUBGRAPH_PADDING_X,
  SUBGRAPH_PADDING_TOP,
  SUBGRAPH_PADDING_BOTTOM,
} from '@/lib/pipeline-shared/layout/layoutConstants'

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
  /**
   * Free-text / annotation nodes are placed after layout and must not inflate
   * a group's bounding box (they are still repositioned relative to it).
   */
  excludeFromBounds?: boolean
}

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
      if (child.excludeFromBounds) continue
      const cw = child.width ?? 0
      const ch = child.height ?? 0
      if (child.absX < minX) minX = child.absX
      if (child.absY < minY) minY = child.absY
      if (child.absX + cw > maxX) maxX = child.absX + cw
      if (child.absY + ch > maxY) maxY = child.absY + ch
    }
    if (minX === Infinity) {
      // Bounds-only children (e.g. a group containing just free text): keep
      // the group as-is but still sync abs coords and reposition children.
      group.absX = group.position.x
      group.absY = group.position.y
      for (const childId of childIds) {
        const child = leaves.get(childId) || groups.get(childId)
        if (!child) continue
        child.position = { x: child.absX - group.absX, y: child.absY - group.absY }
      }
      continue
    }

    const newWidth = maxX - minX + SUBGRAPH_PADDING_X * 2
    const newHeight = maxY - minY + SUBGRAPH_PADDING_BOTTOM + SUBGRAPH_PADDING_TOP
    const newX = minX - SUBGRAPH_PADDING_X
    const newY = minY - SUBGRAPH_PADDING_TOP

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

interface RfLikeNode {
  id: string
  type?: string
  position: { x: number; y: number }
  width?: number | null
  height?: number | null
  parentNode?: string
  parentId?: string
  data?: Record<string, unknown>
  // Loosely typed: React Flow node `style` is CSSProperties, pipeline nodes
  // use plain records — the adapter only reads/copies it.
  style?: unknown
}

/**
 * RF-shaped entry point to `recomputeSubgraphBounds` — THE canonical subgraph
 * sizing pass. Use this after any layout that emits children at absolute
 * positions (dagre compound output): it resizes every group to its children's
 * bounding box and converts child positions to parent-relative coordinates.
 *
 * Replaces the old nesting-unaware `sizeSubgraphs`, which mishandled nested
 * groups (inner groups hit the "make relative" branch before their own bounds
 * were recomputed, leaving stale sizes / overflowing children).
 */
export function applySubgraphBoundsToRf<T extends RfLikeNode>(nodes: T[]): T[] {
  const isGroup = (n: RfLikeNode) => n.type === 'groupNode' || n.data?.isGroup === true

  const inputs: SubgraphBoundsNode[] = nodes.map((n) => ({
    id: n.id,
    parentNode: n.parentNode ?? n.parentId,
    position: { x: n.position.x, y: n.position.y },
    width: n.width ?? 0,
    height: n.height ?? 0,    absX: n.position.x,
    absY: n.position.y,
    isGroup: isGroup(n),
    data: n.data,
    style: n.style as CSSProperties | undefined,
    excludeFromBounds: isTextNode(n),
  }))
  recomputeSubgraphBounds(inputs)
  const byId = new Map(inputs.map((n) => [n.id, n]))

  return nodes.map((n) => {
    const sized = byId.get(n.id)
    if (!sized) return n
    if (isGroup(n)) {
      return {
        ...n,
        position: { ...sized.position },
        width: sized.width,
        height: sized.height,
        style: {
          ...(n.style as Record<string, unknown> | undefined),
          width: sized.width,
          height: sized.height,
        },
      }
    }
    // Children come back parent-relative.
    return { ...n, position: { ...sized.position } }
  })
}
