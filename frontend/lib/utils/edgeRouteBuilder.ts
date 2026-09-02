import type { Edge, Node } from 'reactflow'
import { Position } from '@/lib/utils/edgePositions'
import { type ObstacleRect } from './obstacleRect'
import { getBoundaryAnchor, getEdgeShiftOffset } from './simpleFloatingEdge'
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions'
import { hasReverseEdge, resolveBidirectionalFacingSides } from './handleSlotOrder'
import logger from '@/lib/logger'
import { buildSmoothStepSvg, getCollisionFreeWaypoints, segmentIntersectsRect } from './collisionFreeEdgePath'
import {
  selectBestHandlerPair,
  scoreAllHandlerPairs,
  buildDefaultOrthogonalWaypoints,
  anchorOutsideBoundary,
  type HandlerRect,
  type HandlerPairScore,
} from './handlerPairScorer'

export interface EdgeRouteResult {
  sourcePosition: Position
  targetPosition: Position
  sourcePoint: { x: number; y: number }
  targetPoint: { x: number; y: number }
  waypoints: Array<{ x: number; y: number }>
  svgPath: string
}

function buildCustomWaypointPath(
  sourcePoint: { x: number; y: number },
  targetPoint: { x: number; y: number },
  customWaypoints: Array<{ x: number; y: number }>,
  borderRadius: number = 24,
): { waypoints: Array<{ x: number; y: number }>; svgPath: string } {
  const allPoints = [
    sourcePoint,
    ...customWaypoints,
    targetPoint,
  ]
  const svgPath = buildSmoothStepSvg(allPoints, borderRadius)
  return { waypoints: allPoints, svgPath }
}

function getAbsolutePosition(node: Node, nodes: Node[]): { x: number; y: number } {
  let x = node.position?.x ?? 0
  let y = node.position?.y ?? 0
  let current = node
  const visited = new Set<string>([node.id])
  while (current.parentId || current.parentNode) {
    const pId = current.parentId || current.parentNode
    if (!pId || visited.has(pId)) break
    visited.add(pId)
    const parent = nodes.find(n => n.id === pId)
    if (!parent || !parent.position) break
    x += parent.position.x
    y += parent.position.y
    current = parent
  }
  return { x, y }
}

function getNodeRect(node: Node, nodes: Node[]): ObstacleRect {
  const pos = getAbsolutePosition(node, nodes)
  const { width: w, height: h } = getEffectiveNodeDimensions(node)
  return { x: pos.x, y: pos.y, w, h }
}

export function isGroupNode(node: Node): boolean {
  return (
    node.type === 'groupNode' ||
    node.type === 'frameNode' ||
    node.type === 'group' ||
    node.type === 'demoGroup' ||
    node.data?.isGroup === true
  )
}

function sideToPosition(side: string | undefined): Position | undefined {
  if (side === 'left') return Position.Left
  if (side === 'right') return Position.Right
  if (side === 'top') return Position.Top
  if (side === 'bottom') return Position.Bottom
  return undefined
}

/**
 * Collects the ids of every group node that contains `nodeId` (all ancestors
 * through the parent chain). An edge may always cross its own groups'
 * boundaries because its endpoints live inside them, so these groups must
 * not be treated as routing obstacles — otherwise the edge could never leave
 * (or stay inside) its container.
 */
function getAncestorGroupIds(nodeId: string, nodes: Node[]): Set<string> {
  const result = new Set<string>()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  let currentId = nodeById.get(nodeId)
  while (currentId && !visited.has(currentId.id)) {
    visited.add(currentId.id)
    const parentId = currentId.parentId || (currentId as Node & { parentNode?: string }).parentNode
    if (!parentId) break
    const parent = nodeById.get(parentId)
    if (!parent) break
    if (isGroupNode(parent)) result.add(parentId)
    currentId = parent
  }
  return result
}

function buildBlockingNodeRects(
  nodes: Node[],
  excludedIds: Set<string>,
  passableGroupIds: Set<string> = new Set(),
): Map<string, { id: string; x: number; y: number; w: number; h: number }> {
  const nodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>()
  for (const node of nodes) {
    if (excludedIds.has(node.id)) continue
    if (isGroupNode(node)) {
      // Edges of a group (their endpoints live inside it) may pass through
      // that group, but must not slice through any other group's rectangle.
      if (passableGroupIds.has(node.id)) continue
    }
    const rect = getNodeRect(node, nodes)
    nodeRects.set(node.id, { id: node.id, ...rect })
  }
  return nodeRects
}

function pathCollidesWithRects(
  waypoints: Array<{ x: number; y: number }>,
  nodeRects: Map<string, { id: string; x: number; y: number; w: number; h: number }>
): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (const [, rect] of nodeRects) {
      if (segmentIntersectsRect(
        waypoints[i].x,
        waypoints[i].y,
        waypoints[i + 1].x,
        waypoints[i + 1].y,
        rect.x,
        rect.y,
        rect.w,
        rect.h
      )) {
        return true
      }
    }
  }
  return false
}

/**
 * True if the orthogonal path clips the interior of source or target.
 * Endpoints sit outside the node, so a correct path must never enter either.
 */
function pathEntersTerminalInterior(
  waypoints: Array<{ x: number; y: number }>,
  sourceRect: ObstacleRect,
  targetRect: ObstacleRect,
): boolean {
  const pad = 2
  const shrink = (r: ObstacleRect) => ({
    x: r.x + pad,
    y: r.y + pad,
    w: Math.max(1, r.w - pad * 2),
    h: Math.max(1, r.h - pad * 2),
  })
  const src = shrink(sourceRect)
  const tgt = shrink(targetRect)

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, src.x, src.y, src.w, src.h)) return true
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, tgt.x, tgt.y, tgt.w, tgt.h)) return true
  }
  return false
}

/**
 * Computes waypoints between two boundary anchors.
 * Avoids regular nodes and the source/target terminals themselves.
 */
function computeDirectWaypoints(
  sh: { x: number; y: number },
  th: { x: number; y: number },
  sourcePosition: Position,
  targetPosition: Position,
  edgeOffset: number,
  nodeRects: Map<string, { id: string; x: number; y: number; w: number; h: number }> | undefined,
  sourceRect: ObstacleRect,
  targetRect: ObstacleRect,
  borderRadius: number = 24,
): Array<{ x: number; y: number }> {
  const directWaypoints = buildDefaultOrthogonalWaypoints(
    sh, th, sourcePosition, targetPosition, edgeOffset,
  )

  const hitsObstacle = !!(nodeRects && nodeRects.size > 0 && pathCollidesWithRects(directWaypoints, nodeRects))
  const hitsTerminal = pathEntersTerminalInterior(directWaypoints, sourceRect, targetRect)

  if (!hitsObstacle && !hitsTerminal) {
    return directWaypoints
  }

  // Include source/target as obstacles so detours cannot tunnel through them.
  // Anchors sit outside the node bounds, so A*/safe-path start cells stay free.
  const routingRects = new Map(nodeRects ?? [])
  routingRects.set('__edge_source__', { id: '__edge_source__', ...sourceRect })
  routingRects.set('__edge_target__', { id: '__edge_target__', ...targetRect })

  return getCollisionFreeWaypoints({
    sourceX: sh.x, sourceY: sh.y,
    targetX: th.x, targetY: th.y,
    sourcePosition,
    targetPosition,
    borderRadius,
    edgeOffset,
    nodeRects: routingRects,
    excludedNodeIds: new Set(),
  })
}

function toHandlerRect(r: ObstacleRect): HandlerRect {
  return { x: r.x, y: r.y, width: r.w, height: r.h };
}

function buildScorerObstacles(
  nodes: Node[],
  excludedIds: Set<string>,
  passableGroupIds: Set<string> = new Set(),
): Map<string, HandlerRect> {
  const map = new Map<string, HandlerRect>()
  for (const node of nodes) {
    if (excludedIds.has(node.id)) continue
    if (isGroupNode(node)) {
      if (passableGroupIds.has(node.id)) continue
    }
    const rect = getNodeRect(node, nodes)
    map.set(node.id, toHandlerRect(rect))
  }
  return map
}

function orthogonalPenetratesTerminal(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  sourceSide: Position,
  targetSide: Position,
): boolean {
  const srcA = anchorOutsideBoundary(sourceRect, sourceSide)
  const tgtA = anchorOutsideBoundary(targetRect, targetSide)
  const waypoints = buildDefaultOrthogonalWaypoints(srcA, tgtA, sourceSide, targetSide)

  const pad = 2
  const shrunkenSource = {
    x: sourceRect.x + pad,
    y: sourceRect.y + pad,
    width: Math.max(1, sourceRect.width - pad * 2),
    height: Math.max(1, sourceRect.height - pad * 2),
  }
  const shrunkenTarget = {
    x: targetRect.x + pad,
    y: targetRect.y + pad,
    width: Math.max(1, targetRect.width - pad * 2),
    height: Math.max(1, targetRect.height - pad * 2),
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    if (segmentIntersectsRect(
      a.x, a.y, b.x, b.y,
      shrunkenSource.x, shrunkenSource.y, shrunkenSource.width, shrunkenSource.height,
    )) {
      return true
    }
    if (segmentIntersectsRect(
      a.x, a.y, b.x, b.y,
      shrunkenTarget.x, shrunkenTarget.y, shrunkenTarget.width, shrunkenTarget.height,
    )) {
      return true
    }
  }
  return false
}

function applyLaneBias(
  scores: HandlerPairScore[],
  laneSourcePreference?: Position,
  laneTargetPreference?: Position,
): HandlerPairScore[] {
  const LANE_BIAS = -50
  const hasLane =
    laneSourcePreference !== undefined || laneTargetPreference !== undefined
  if (!hasLane) return scores

  const biased = scores.map(s => {
    let total = s.total
    if (laneSourcePreference !== undefined && s.pair.sourceSide === laneSourcePreference) {
      total += LANE_BIAS
    }
    if (laneTargetPreference !== undefined && s.pair.targetSide === laneTargetPreference) {
      total += LANE_BIAS
    }
    return { ...s, total }
  })
  biased.sort((a, b) => a.total - b.total)
  return biased
}

/**
 * Resolve which side an edge uses on a given node — prefers stored overrides,
 * otherwise runs the same scorer used for rendering.
 * Per-edge obstacle sets (excluded = that edge's endpoints) match
 * useHandleSlotLayout.resolveScorerSide so handle dots and edge anchors stay aligned.
 */
function resolveEdgeSideOnNode(
  e: Edge,
  nodeId: string,
  nodes: Node[],
  direction: 'LR' | 'TD',
  _allObstacles?: Map<string, HandlerRect>,
): Position {
  // Floating-side behavior: handle ids no longer pin a side. Only explicit
  // user/lane overrides are respected; everything else re-scores from live
  // geometry every frame so edges hop to the natural side as nodes move.

  const data = e.data as Record<string, unknown> | undefined
  if (e.source === nodeId) {
    const manual = sideToPosition(data?.sourceSide as string)
    if (manual !== undefined) return manual
    const lane = sideToPosition(data?.laneSourceSide as string)
    if (lane !== undefined) return lane
  } else if (e.target === nodeId) {
    const manual = sideToPosition(data?.targetSide as string)
    if (manual !== undefined) return manual
    const lane = sideToPosition(data?.laneTargetSide as string)
    if (lane !== undefined) return lane
  } else {
    return Position.Right
  }

  const sourceNode = nodes.find(n => n.id === e.source)
  const targetNode = nodes.find(n => n.id === e.target)
  if (!sourceNode || !targetNode) {
    return Position.Right
  }

  const sourceRect = getNodeRect(sourceNode, nodes)
  const targetRect = getNodeRect(targetNode, nodes)
  const excluded = new Set([e.source, e.target])
  // Match useHandleSlotLayout: per-edge obstacles, not the main edge's.
  const passableGroupIds = new Set<string>([
    ...getAncestorGroupIds(e.source, nodes),
    ...getAncestorGroupIds(e.target, nodes),
  ])
  const obstacles = buildScorerObstacles(nodes, excluded, passableGroupIds)
  const pair = selectBestHandlerPair(
    { x: sourceRect.x, y: sourceRect.y, width: sourceRect.w, height: sourceRect.h },
    { x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h },
    direction,
    obstacles.size > 0 ? obstacles : undefined,
    excluded,
    sideToPosition(data?.sourceSide as string),
    sideToPosition(data?.targetSide as string),
    sideToPosition(data?.laneSourceSide as string),
    sideToPosition(data?.laneTargetSide as string),
  )
  return e.source === nodeId ? pair.sourceSide : pair.targetSide
}

export type EdgeRouteDirection = 'LR' | 'TD';

export function computeEdgeRoute(
  edge: Edge,
  nodes: Node[],
  edges: Edge[],
  direction: EdgeRouteDirection = 'LR',
  renderStyleId?: string,
): EdgeRouteResult {
  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  const defaultResult = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourcePoint: { x: 0, y: 0 },
    targetPoint: { x: 0, y: 0 },
    waypoints: [],
    svgPath: '',
  }

  if (!sourceNode || !targetNode) return defaultResult

  const brutal = renderStyleId === 'neubrutalism';
  const curveRadius = brutal ? 10 : 24;

  if (edge.source === edge.target) {
    const sRect = getNodeRect(sourceNode, nodes)
    const cx = sRect.x + sRect.w / 2
    const cy = sRect.y + sRect.h / 2
    const top = sRect.y
    const right = sRect.x + sRect.w
    const r = 40
    return {
      sourcePosition: Position.Top,
      targetPosition: Position.Right,
      sourcePoint: { x: cx, y: top },
      targetPoint: { x: right, y: cy },
      waypoints: [
        { x: cx, y: top },
        { x: cx + r, y: top - r },
        { x: right + r, y: cy - r },
        { x: right, y: cy },
      ],
      svgPath: `M ${cx},${top} C ${cx},${top - r} ${right + r},${cy - r} ${right},${cy}`,
    }
  }

  const sourceRect = getNodeRect(sourceNode, nodes)
  const targetRect = getNodeRect(targetNode, nodes)
  const edgeData = edge.data as Record<string, unknown> | undefined

  // `direction` is now passed in by the caller (the parent component reads
  // activeLayoutPresetId from the store and maps 'layered-tb' -> 'TD'). Keeping
  // this library free of store reads prevents an inverted layering dependency
  // where a geometry utility would import the UI state container.

  const laneSourcePreference = sideToPosition(edgeData?.laneSourceSide as string)
  const laneTargetPreference = sideToPosition(edgeData?.laneTargetSide as string)

  const excludedIds = new Set([edge.source, edge.target])
  // Groups containing either endpoint are passable (the edge starts/ends
  // inside them); every other group is an obstacle so edges of one group
  // never cut across another group's rectangle.
  const passableGroupIds = new Set<string>([
    ...getAncestorGroupIds(edge.source, nodes),
    ...getAncestorGroupIds(edge.target, nodes),
  ])
  const scorerObstacles = buildScorerObstacles(nodes, excludedIds, passableGroupIds)
  const srcHandlerRect: HandlerRect = {
    x: sourceRect.x, y: sourceRect.y, width: sourceRect.w, height: sourceRect.h,
  }
  const tgtHandlerRect: HandlerRect = {
    x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h,
  }

  const bidirectionalSides = resolveBidirectionalFacingSides(edge, edges, srcHandlerRect, tgtHandlerRect)
  let manualSourceSide = sideToPosition(edgeData?.sourceSide as string)
  let manualTargetSide = sideToPosition(edgeData?.targetSide as string)
  if (bidirectionalSides) {
    manualSourceSide = bidirectionalSides.sourceSide
    manualTargetSide = bidirectionalSides.targetSide
  }

  // Custom waypoints: keep stored sides when present; only score if missing.
  const customWaypoints = edgeData?.customWaypoints as Array<{ x: number; y: number }> | undefined
  if (customWaypoints && customWaypoints.length > 0 && !hasReverseEdge(edge, edges)) {
    let sourcePosition: Position
    let targetPosition: Position

    if (manualSourceSide !== undefined && manualTargetSide !== undefined) {
      sourcePosition = manualSourceSide
      targetPosition = manualTargetSide
    } else {
      const handlerPair = selectBestHandlerPair(
        srcHandlerRect,
        tgtHandlerRect,
        direction,
        scorerObstacles,
        excludedIds,
        manualSourceSide,
        manualTargetSide,
        laneSourcePreference,
        laneTargetPreference,
      )
      sourcePosition = handlerPair.sourceSide
      targetPosition = handlerPair.targetSide
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const sourceShift = getEdgeShiftOffset(
      edge.source, edge.id, sourcePosition, edges, nodeMap, 24,
      undefined, undefined,
      (e, nodeId) => resolveEdgeSideOnNode(e, nodeId, nodes, direction, scorerObstacles),
    )
    const targetShift = getEdgeShiftOffset(
      edge.target, edge.id, targetPosition, edges, nodeMap, 24,
      undefined, undefined,
      (e, nodeId) => resolveEdgeSideOnNode(e, nodeId, nodes, direction, scorerObstacles),
    )
    let sh = getBoundaryAnchor(
      sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h,
      sourcePosition, sourceShift,
    )
    let th = getBoundaryAnchor(
      targetRect.x, targetRect.y, targetRect.w, targetRect.h,
      targetPosition, targetShift,
    )
    // Same straight-snap as main path — keeps custom edges from wavering when anchors are ~aligned
    {
      const STRAIGHT_SNAP = 8;
      const isH = (sourcePosition === Position.Right && targetPosition === Position.Left) || (sourcePosition === Position.Left && targetPosition === Position.Right);
      const isV = (sourcePosition === Position.Top && targetPosition === Position.Bottom) || (sourcePosition === Position.Bottom && targetPosition === Position.Top);
      if (isH && Math.abs(sh.y - th.y) < STRAIGHT_SNAP) {
        const avgY = Math.round((sh.y + th.y) / 2);
        sh = { ...sh, y: avgY };
        th = { ...th, y: avgY };
      } else if (isV && Math.abs(sh.x - th.x) < STRAIGHT_SNAP) {
        const avgX = Math.round((sh.x + th.x) / 2);
        sh = { ...sh, x: avgX };
        th = { ...th, x: avgX };
      }
    }

    const { waypoints, svgPath } = buildCustomWaypointPath(sh, th, customWaypoints, curveRadius)

    return {
      sourcePosition,
      targetPosition,
      sourcePoint: sh,
      targetPoint: th,
      waypoints,
      svgPath,
    }
  }

  if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
    logger.debug('[EdgeDebug:3-RouteBuilder] edge=%s  manual=(%s,%s)  lane=(%s,%s)  scoring=%s',
      edge.id,
      edgeData?.sourceSide ?? '-', edgeData?.targetSide ?? '-',
      edgeData?.laneSourceSide ?? '-', edgeData?.laneTargetSide ?? '-',
      (manualSourceSide !== undefined && manualTargetSide !== undefined) ? 'BYPASSED' : 'ACTIVE');
  }

  const handlerPair = selectBestHandlerPair(
    srcHandlerRect,
    tgtHandlerRect,
    direction,
    scorerObstacles,
    excludedIds,
    manualSourceSide,
    manualTargetSide,
    laneSourcePreference,
    laneTargetPreference,
  )

  let sourcePosition = handlerPair.sourceSide
  let targetPosition = handlerPair.targetSide

  if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
    logger.debug('[EdgeDebug:4-Final] edge=%s  src=%s→%s  tgt=%s→%s',
      edge.id, edge.source, sourcePosition, edge.target, targetPosition);
  }

  // Terminal penetration guard on orthogonal path; respect lane prefs when falling back.
  const hasUserOverride = manualSourceSide !== undefined && manualTargetSide !== undefined
  if (!hasUserOverride && orthogonalPenetratesTerminal(
    srcHandlerRect, tgtHandlerRect, sourcePosition, targetPosition,
  )) {
    let scores = scoreAllHandlerPairs(
      srcHandlerRect, tgtHandlerRect, direction, scorerObstacles, excludedIds,
    )
    scores = applyLaneBias(scores, laneSourcePreference, laneTargetPreference)
    if (manualSourceSide !== undefined || manualTargetSide !== undefined) {
      scores = scores.filter(s => {
        if (manualSourceSide !== undefined && s.pair.sourceSide !== manualSourceSide) return false
        if (manualTargetSide !== undefined && s.pair.targetSide !== manualTargetSide) return false
        return true
      })
    }
    const fallback = scores.find(s => {
      if (s.pair.sourceSide === sourcePosition && s.pair.targetSide === targetPosition) return false
      return !orthogonalPenetratesTerminal(
        srcHandlerRect, tgtHandlerRect, s.pair.sourceSide, s.pair.targetSide,
      )
    })
    if (fallback) {
      if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
        logger.debug('[EdgeDebug:Guard] edge=%s  PENETRATION DETECTED (%s→%s), falling back to %s→%s',
          edge.id, sourcePosition, targetPosition,
          fallback.pair.sourceSide, fallback.pair.targetSide)
      }
      sourcePosition = fallback.pair.sourceSide
      targetPosition = fallback.pair.targetSide
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const resolveSide = (e: Edge, nodeId: string) =>
    resolveEdgeSideOnNode(e, nodeId, nodes, direction, scorerObstacles)

  const sourceShift = getEdgeShiftOffset(
    edge.source, edge.id, sourcePosition, edges, nodeMap, 24,
    undefined, undefined, resolveSide,
  )
  const targetShift = getEdgeShiftOffset(
    edge.target, edge.id, targetPosition, edges, nodeMap, 24,
    undefined, undefined, resolveSide,
  )
  let sh = getBoundaryAnchor(
    sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h,
    sourcePosition, sourceShift,
  )
  let th = getBoundaryAnchor(
    targetRect.x, targetRect.y, targetRect.w, targetRect.h,
    targetPosition, targetShift,
  )

  // Auto-straighten: if edge is nearly horizontal/vertical, snap to make it perfectly straight
  // so small 2-8px misalignments don't create the wavy S-jog seen in screenshots.
  // Keeps full freedom — only snaps when already close, and respects custom waypoints.
  const STRAIGHT_SNAP = 8;
  const isHorizontalPair =
    (sourcePosition === Position.Right && targetPosition === Position.Left) ||
    (sourcePosition === Position.Left && targetPosition === Position.Right);
  const isVerticalPair =
    (sourcePosition === Position.Top && targetPosition === Position.Bottom) ||
    (sourcePosition === Position.Bottom && targetPosition === Position.Top);
  if (isHorizontalPair && Math.abs(sh.y - th.y) < STRAIGHT_SNAP) {
    const avgY = Math.round((sh.y + th.y) / 2);
    sh = { ...sh, y: avgY };
    th = { ...th, y: avgY };
  } else if (isVerticalPair && Math.abs(sh.x - th.x) < STRAIGHT_SNAP) {
    const avgX = Math.round((sh.x + th.x) / 2);
    sh = { ...sh, x: avgX };
    th = { ...th, x: avgX };
  }

  // Intermediate nodes only for the obstacle map — source/target are added
  // inside computeDirectWaypoints so detours cannot tunnel through terminals.
  const nodeRects = buildBlockingNodeRects(nodes, excludedIds, passableGroupIds)
  const nodeRectParam = nodeRects.size > 0 ? nodeRects : undefined
  const parallelEdges = edges.filter(
    (e) => e.source === edge.source && e.target === edge.target,
  )
  const edgeOffset = parallelEdges.length > 1
    ? (() => {
        const index = parallelEdges.findIndex((e) => e.id === edge.id)
        return index === -1 ? 0 : (index - (parallelEdges.length - 1) / 2) * 20
      })()
    : 0

  const waypointsRaw = computeDirectWaypoints(
    sh, th, sourcePosition, targetPosition, edgeOffset,
    nodeRectParam, sourceRect, targetRect,
    curveRadius,
  )
  let waypoints = waypointsRaw
  let svgPath = buildSmoothStepSvg(waypoints, curveRadius)

  // Degenerate case: coincident anchors (overlapping nodes) produce a single
  // point after deduplication → empty SVG. Always return a visible fallback so
  // the edge never disappears while dragging.
  if (!svgPath || waypoints.length < 2) {
    const dx = th.x - sh.x
    const dy = th.y - sh.y
    const dist = Math.hypot(dx, dy)
    if (dist < 12) {
      const isH = sourcePosition === Position.Left || sourcePosition === Position.Right
      const offset = 50
      const perpX = isH ? 0 : offset
      const perpY = isH ? offset : 0
      // Small U-shaped detour perpendicular to the terminal side, offset
      // consistently so parallel edges remain separated.
      const mid1 = { x: sh.x + perpX, y: sh.y + perpY }
      const mid2 = { x: th.x + perpX, y: th.y + perpY }
      const fallback = [sh, mid1, mid2, th]
      waypoints = fallback
      svgPath = buildSmoothStepSvg(fallback, curveRadius) || `M ${sh.x},${sh.y} L ${mid1.x},${mid1.y} L ${mid2.x},${mid2.y} L ${th.x},${th.y}`
    } else if (!svgPath) {
      // Non-coincident but still empty (e.g. duplicate points) → straight line fallback
      waypoints = [sh, th]
      svgPath = `M ${sh.x},${sh.y} L ${th.x},${th.y}`
    }
  }

  return {
    sourcePosition,
    targetPosition,
    sourcePoint: sh,
    targetPoint: th,
    waypoints,
    svgPath,
  }
}
