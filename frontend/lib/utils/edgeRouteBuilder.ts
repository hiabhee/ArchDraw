import { Edge, Node, Position } from 'reactflow'
import { planPath, type ObstacleRect } from '../features/pathPlanner'
import { getObstacleAwareHandles } from '../features/dynamicHandles'
import { getEdgeShiftOffset, getSimpleHandlePosition } from './simpleFloatingEdge'
import { buildSmoothStepSvg, getCollisionFreeWaypoints, segmentIntersectsRect } from './collisionFreeEdgePath'
import { useDiagramStore } from '@/store/diagramStore'

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
  borderRadius: number = 12,
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
  const w = node.width ?? (node as Node & { measured?: { width?: number } }).measured?.width ?? node.data?.nodeWidth ?? 160
  const h = node.height ?? (node as Node & { measured?: { height?: number } }).measured?.height ?? node.data?.nodeHeight ?? 80
  return { x: pos.x, y: pos.y, w, h }
}

function isGroupNode(node: Node): boolean {
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

function collectExistingEdgePaths(edges: Edge[], currentEdgeId: string): Array<{ x: number; y: number }[]> {
  const paths: Array<{ x: number; y: number }[]> = []
  for (const e of edges) {
    if (e.id === currentEdgeId) continue
    const d = e.data as Record<string, unknown> | undefined
    const pts = d?.__cachedWaypoints as Array<{ x: number; y: number }> | undefined
    if (pts && pts.length >= 2) {
      paths.push(pts)
    }
  }
  return paths
}

function buildBlockingNodeRects(
  nodes: Node[],
  excludedIds: Set<string>
): Map<string, { id: string; x: number; y: number; w: number; h: number }> {
  const nodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>()
  for (const node of nodes) {
    if (excludedIds.has(node.id)) continue
    if (isGroupNode(node)) continue
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

const portPairCache = new Map<string, { sourcePosition: Position; targetPosition: Position }>()

export function clearPortPairCache(): void {
  portPairCache.clear()
}

export function computeEdgeRoute(
  edge: Edge,
  nodes: Node[],
  edges: Edge[]
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

  const cacheKey = `${edge.source}|${edge.target}`
  const preferredPair = portPairCache.get(cacheKey)

  if (edge.source === edge.target) {
    const sRect = getNodeRect(sourceNode, nodes)
    const cx = sRect.x + sRect.w / 2
    const top = sRect.y
    const right = sRect.x + sRect.w
    const r = 40
    return {
      sourcePosition: Position.Top,
      targetPosition: Position.Right,
      sourcePoint: { x: cx, y: top },
      targetPoint: { x: right, y: cx },
      waypoints: [
        { x: cx, y: top },
        { x: cx + r, y: top - r },
        { x: right + r, y: cx - r },
        { x: right, y: cx },
      ],
      svgPath: `M ${cx},${top} C ${cx},${top - r} ${right + r},${cx - r} ${right},${cx}`,
    }
  }

  const sourceRect = getNodeRect(sourceNode, nodes)
  const targetRect = getNodeRect(targetNode, nodes)

  // Lane edges: use dynamic handle selection (cheaper than planPath) without frozen overrides
  const edgeData = edge.data as Record<string, unknown> | undefined

  // Custom waypoints: if the user has manually edited the edge path, use their waypoints
  const customWaypoints = edgeData?.customWaypoints as Array<{ x: number; y: number }> | undefined
  if (customWaypoints && customWaypoints.length > 0) {
    const manualSourceSide = sideToPosition(edgeData?.sourceSide as string)
    const manualTargetSide = sideToPosition(edgeData?.targetSide as string)

    // Determine source/target positions from manual overrides or auto-detect
    const activePreset = useDiagramStore.getState().activeLayoutPresetId
    const direction = activePreset === 'layered-tb' ? 'TD' : 'LR'

    let sourcePosition = manualSourceSide
    let targetPosition = manualTargetSide

    if (!sourcePosition || !targetPosition) {
      const handles = getObstacleAwareHandles(
        { x: sourceRect.x, y: sourceRect.y, width: sourceRect.w, height: sourceRect.h },
        { x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h },
        undefined, undefined,
        edge.id, edge.source, edge.target, edge.data,
        sourceNode.data?.serviceType, targetNode.data?.serviceType, direction,
        preferredPair,
      )
      sourcePosition = sourcePosition || handles.sourcePosition
      targetPosition = targetPosition || handles.targetPosition
    }

    const sourceShift = getEdgeShiftOffset(edge.source, edge.id, sourcePosition, edges, new Map(nodes.map(n => [n.id, n])), 12, undefined, undefined)
    const targetShift = getEdgeShiftOffset(edge.target, edge.id, targetPosition, edges, new Map(nodes.map(n => [n.id, n])), 12, undefined, undefined)
    const sh = getSimpleHandlePosition(sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h, sourcePosition, sourceShift, 'source')
    const th = getSimpleHandlePosition(targetRect.x, targetRect.y, targetRect.w, targetRect.h, targetPosition, targetShift, 'target')

    const { waypoints, svgPath } = buildCustomWaypointPath(sh, th, customWaypoints)

    const edgeDataObj = edge.data as Record<string, unknown> || {}
    edgeDataObj.__cachedWaypoints = waypoints

    return {
      sourcePosition,
      targetPosition,
      sourcePoint: sh,
      targetPoint: th,
      waypoints,
      svgPath,
    }
  }
  const manualSourceSide = sideToPosition(edgeData?.sourceSide as string)
  const manualTargetSide = sideToPosition(edgeData?.targetSide as string)
  const laneSourceSide = sideToPosition(edgeData?.laneSourceSide as string)
  const laneTargetSide = sideToPosition(edgeData?.laneTargetSide as string)
  const forcedSourceSide = manualSourceSide || laneSourceSide
  const forcedTargetSide = manualTargetSide || laneTargetSide

  if (forcedSourceSide || forcedTargetSide) {
    const activePreset = useDiagramStore.getState().activeLayoutPresetId
    const direction = activePreset === 'layered-tb' ? 'TD' : 'LR'

    const handles = getObstacleAwareHandles(
      { x: sourceRect.x, y: sourceRect.y, width: sourceRect.w, height: sourceRect.h },
      { x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h },
      undefined, undefined,
      edge.id, edge.source, edge.target, edge.data,
      sourceNode.data?.serviceType, targetNode.data?.serviceType, direction,
      preferredPair,
    )

    const sourcePosition = forcedSourceSide || handles.sourcePosition
    const targetPosition = forcedTargetSide || handles.targetPosition

    const sourceShift = getEdgeShiftOffset(edge.source, edge.id, sourcePosition, edges, new Map(nodes.map(n => [n.id, n])), 12, undefined, undefined)
    const targetShift = getEdgeShiftOffset(edge.target, edge.id, targetPosition, edges, new Map(nodes.map(n => [n.id, n])), 12, undefined, undefined)
    const sh = getSimpleHandlePosition(sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h, sourcePosition, sourceShift, 'source')
    const th = getSimpleHandlePosition(targetRect.x, targetRect.y, targetRect.w, targetRect.h, targetPosition, targetShift, 'target')

    const excludedIds = new Set([edge.source, edge.target])
    const nodeRects = buildBlockingNodeRects(nodes, excludedIds)
    const nodeRectParam = nodeRects.size > 0 ? nodeRects : undefined
    const edgeOffset = (() => {
      const parallelEdges = edges.filter(
        (e) => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source)
      )
      if (parallelEdges.length <= 1) return 0
      const index = parallelEdges.findIndex((e) => e.id === edge.id)
      return index === -1 ? 0 : (index - (parallelEdges.length - 1) / 2) * 20
    })()

    const sourceIsH = sourcePosition === Position.Left || sourcePosition === Position.Right
    const targetIsH = targetPosition === Position.Left || targetPosition === Position.Right

    let directWaypoints: Array<{ x: number; y: number }>
    if (sourceIsH && targetIsH) {
      const mx = (sh.x + th.x) / 2
      directWaypoints = [
        { x: sh.x, y: sh.y },
        { x: mx, y: sh.y },
        { x: mx, y: th.y },
        { x: th.x, y: th.y },
      ]
    } else if (!sourceIsH && !targetIsH) {
      const my = (sh.y + th.y) / 2
      directWaypoints = [
        { x: sh.x, y: sh.y },
        { x: sh.x, y: my },
        { x: th.x, y: my },
        { x: th.x, y: th.y },
      ]
    } else if (sourceIsH) {
      directWaypoints = [
        { x: sh.x, y: sh.y },
        { x: th.x, y: sh.y },
        { x: th.x, y: th.y },
      ]
    } else {
      directWaypoints = [
        { x: sh.x, y: sh.y },
        { x: sh.x, y: th.y },
        { x: th.x, y: th.y },
      ]
    }
    const waypoints = nodeRectParam && pathCollidesWithRects(directWaypoints, nodeRects)
      ? getCollisionFreeWaypoints({
          sourceX: sh.x, sourceY: sh.y,
          targetX: th.x, targetY: th.y,
          sourcePosition,
          targetPosition,
          borderRadius: 24,
          edgeOffset,
          nodeRects: nodeRectParam,
          excludedNodeIds: excludedIds,
        })
      : directWaypoints
    const svgPath = buildSmoothStepSvg(waypoints, 24)

    const edgeDataObj = edge.data as Record<string, unknown> || {}
    edgeDataObj.__cachedWaypoints = waypoints

    portPairCache.set(cacheKey, { sourcePosition, targetPosition })

    return {
      sourcePosition,
      targetPosition,
      sourcePoint: sh,
      targetPoint: th,
      waypoints,
      svgPath,
    }
  }

  // Build obstacle map from intermediate nodes only. Source and target are
  // valid endpoints, so treating them as hard obstacles rejects normal routes.
  const obstacleMap = new Map<string, ObstacleRect>()
  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) continue
    if (isGroupNode(node)) continue
    const rect = getNodeRect(node, nodes)
    obstacleMap.set(node.id, rect)
  }

  const existingPaths = collectExistingEdgePaths(edges, edge.id)

  const result = planPath({
    sourceRect,
    targetRect,
    obstacles: obstacleMap,
    existingEdgePaths: existingPaths,
    stubLength: 32,
    preferredPair: preferredPair
      ? { source: preferredPair.sourcePosition, target: preferredPair.targetPosition }
      : undefined,
  })

  if (result && result.nodeCrossings === 0) {
    const waypoints = result.points
    const edgeDataObj = edge.data as Record<string, unknown> || {}
    edgeDataObj.__cachedWaypoints = waypoints

    portPairCache.set(cacheKey, { sourcePosition: result.sourcePort.side, targetPosition: result.targetPort.side })

    return {
      sourcePosition: result.sourcePort.side,
      targetPosition: result.targetPort.side,
      sourcePoint: result.sourcePort.point,
      targetPoint: result.targetPort.point,
      waypoints,
      svgPath: result.svgPath,
    }
  }

  // Fallback: use the existing handle-based routing
  const excludedIds = new Set([edge.source, edge.target])
  const nodeRects = buildBlockingNodeRects(nodes, excludedIds)

  const nodeRectParam = nodeRects.size > 0 ? nodeRects : undefined

  const activePreset = useDiagramStore.getState().activeLayoutPresetId
  const direction = activePreset === 'layered-tb' ? 'TD' : 'LR'

  const handles = getObstacleAwareHandles(
    { x: sourceRect.x, y: sourceRect.y, width: sourceRect.w, height: sourceRect.h },
    { x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h },
    nodeRectParam, excludedIds,
    edge.id, edge.source, edge.target, edge.data,
    sourceNode.data?.serviceType, targetNode.data?.serviceType, direction,
    preferredPair,
  )

  const sourceShift = getEdgeShiftOffset(edge.source, edge.id, handles.sourcePosition, edges, new Map(nodes.map(n => [n.id, n])), 12, nodeRectParam, excludedIds)
  const targetShift = getEdgeShiftOffset(edge.target, edge.id, handles.targetPosition, edges, new Map(nodes.map(n => [n.id, n])), 12, nodeRectParam, excludedIds)

  const sh = getSimpleHandlePosition(sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h, handles.sourcePosition, sourceShift, 'source')
  const th = getSimpleHandlePosition(targetRect.x, targetRect.y, targetRect.w, targetRect.h, handles.targetPosition, targetShift, 'target')

  const parallelEdges = edges.filter(
    (e) => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source)
  )
  let edgeOffset = 0
  if (parallelEdges.length > 1) {
    const index = parallelEdges.findIndex((e) => e.id === edge.id)
    if (index !== -1) edgeOffset = (index - (parallelEdges.length - 1) / 2) * 20
  }

  const borderRadius = 24
  const waypoints = getCollisionFreeWaypoints({
    sourceX: sh.x, sourceY: sh.y,
    targetX: th.x, targetY: th.y,
    sourcePosition: handles.sourcePosition,
    targetPosition: handles.targetPosition,
    borderRadius,
    edgeOffset,
    nodeRects: nodeRectParam,
    excludedNodeIds: excludedIds,
  })

  const svgPath = buildSmoothStepSvg(waypoints, borderRadius)

  const edgeDataObj = edge.data as Record<string, unknown> || {}
  edgeDataObj.__cachedWaypoints = waypoints

  portPairCache.set(cacheKey, { sourcePosition: handles.sourcePosition, targetPosition: handles.targetPosition })

  return {
    sourcePosition: handles.sourcePosition,
    targetPosition: handles.targetPosition,
    sourcePoint: sh,
    targetPoint: th,
    waypoints,
    svgPath,
  }
}
