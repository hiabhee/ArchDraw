import type { CSSProperties } from 'react'
import type { Node } from 'reactflow'
import { isTextNode } from './textNodes'
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions'
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles'
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility'
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
export function recomputeSubgraphBounds(nodes: SubgraphBoundsNode[], expandOnly = false): SubgraphBoundsNode[] {
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

    const requiredX = minX - SUBGRAPH_PADDING_X
    const requiredY = minY - SUBGRAPH_PADDING_TOP
    const requiredRight = maxX + SUBGRAPH_PADDING_X
    const requiredBottom = maxY + SUBGRAPH_PADDING_BOTTOM
    const currentRight = group.absX + group.width
    const currentBottom = group.absY + group.height
    const newX = expandOnly ? Math.min(requiredX, group.absX) : requiredX
    const newY = expandOnly ? Math.min(requiredY, group.absY) : requiredY
    const newRight = expandOnly ? Math.max(requiredRight, currentRight) : requiredRight
    const newBottom = expandOnly ? Math.max(requiredBottom, currentBottom) : requiredBottom
    const newWidth = newRight - newX
    const newHeight = newBottom - newY

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

function isRfGroup(node: RfLikeNode): boolean {
  return node.type === 'groupNode' || node.type === 'frameNode' || node.type === 'group' || node.data?.isGroup === true
}

function styleDimension(node: RfLikeNode, key: 'width' | 'height'): number | undefined {
  const value = (node.style as Record<string, unknown> | undefined)?.[key]
  const dimension = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN
  return Number.isFinite(dimension) ? dimension : undefined
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
export function applySubgraphBoundsToRf<T extends RfLikeNode>(nodes: T[], expandOnly = false): T[] {
  const inputs: SubgraphBoundsNode[] = nodes.map((n) => ({
    id: n.id,
    parentNode: n.parentNode ?? n.parentId,
    position: { x: n.position.x, y: n.position.y },
    width: n.width ?? 0,
    height: n.height ?? 0,
    absX: n.position.x,
    absY: n.position.y,
    isGroup: isRfGroup(n),
    data: n.data,
    style: n.style as CSSProperties | undefined,
    excludeFromBounds: isTextNode(n),
  }))
  recomputeSubgraphBounds(inputs, expandOnly)
  const byId = new Map(inputs.map((n) => [n.id, n]))

  return nodes.map((n) => {
    const sized = byId.get(n.id)
    if (!sized) return n
    if (isRfGroup(n)) {
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

/**
 * Ensures persisted React Flow groups contain their rendered children.
 * Canvas nodes store child positions relative to their parents, while the
 * canonical bounds pass consumes absolute positions, so adapt coordinates
 * here and restore parent-relative positions on the way out.
 */
export function ensureSubgraphBoundsContainChildren<T extends RfLikeNode>(
  nodes: T[],
  renderStyleId?: DiagramRenderStyleId | string,
  iconMode?: NodeIconMode,
): T[] {
  if (!nodes.some(isRfGroup)) return nodes

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const absolutePositions = new Map<string, { x: number; y: number }>()
  const getAbsolutePosition = (node: RfLikeNode, visiting = new Set<string>()): { x: number; y: number } => {
    const cached = absolutePositions.get(node.id)
    if (cached) return cached

    const parentId = node.parentNode ?? node.parentId
    const parent = parentId ? nodeById.get(parentId) : undefined
    if (!parent || visiting.has(node.id)) {
      const position = { x: node.position.x, y: node.position.y }
      absolutePositions.set(node.id, position)
      return position
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(node.id)
    const parentPosition = getAbsolutePosition(parent, nextVisiting)
    const position = {
      x: parentPosition.x + node.position.x,
      y: parentPosition.y + node.position.y,
    }
    absolutePositions.set(node.id, position)
    return position
  }

  const absoluteNodes = nodes.map((node) => {
    const position = getAbsolutePosition(node)
    const dimensionsNode = isRfGroup(node)
      ? {
          ...node,
          width: node.width ?? styleDimension(node, 'width'),
          height: node.height ?? styleDimension(node, 'height'),
          data: { ...node.data, isGroup: true },
        }
      : node
    const dimensions = getEffectiveNodeDimensions(
      dimensionsNode as unknown as Node,
      renderStyleId,
      iconMode ?? 'all',
    )
    return {
      ...node,
      parentNode: node.parentNode ?? node.parentId,
      position,
      width: dimensions.width,
      height: dimensions.height,
    }
  })
  const fittedNodes = applySubgraphBoundsToRf(absoluteNodes, true)
  const fittedById = new Map(fittedNodes.map((node) => [node.id, node]))

  return nodes.map((node) => {
    const fitted = fittedById.get(node.id)
    if (!fitted) return node

    const isGroup = isRfGroup(node)
    if (!isGroup) return { ...node, position: fitted.position }

    return {
      ...node,
      position: fitted.position,
      width: fitted.width,
      height: fitted.height,
      style: {
        ...((node.style as Record<string, unknown> | undefined) ?? {}),
        width: fitted.width,
        height: fitted.height,
      },
    }
  })
}
