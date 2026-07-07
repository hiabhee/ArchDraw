import { Position } from 'reactflow'
import { getCollisionFreeWaypoints, segmentIntersectsRect, buildSmoothStepSvg } from '../utils/collisionFreeEdgePath'

export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface Point {
  x: number
  y: number
}

export interface ObstacleRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Port {
  point: Point
  side: Position
}

export interface PathResult {
  sourcePort: Port
  targetPort: Port
  points: Point[]
  svgPath: string
  score: number
  labelPoint: Point
  labelAngle: number
  nodeCrossings: number
  edgeCrossings: number
  bends: number
  length: number
}

export interface PathPlannerConfig {
  sourceRect: ObstacleRect
  targetRect: ObstacleRect
  obstacles: Map<string, ObstacleRect>
  existingEdgePaths?: Point[][]
  stubLength?: number
  minSegmentLength?: number
  minFinalSegment?: number
}

const PORT_OFFSET = 12

function getPortPoint(rect: ObstacleRect, side: Position): Point {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  switch (side) {
    case Position.Top:    return { x: cx, y: rect.y - PORT_OFFSET }
    case Position.Bottom: return { x: cx, y: rect.y + rect.h + PORT_OFFSET }
    case Position.Left:   return { x: rect.x - PORT_OFFSET, y: cy }
    case Position.Right:  return { x: rect.x + rect.w + PORT_OFFSET, y: cy }
  }
}

function exitDir(side: Position): { dx: number; dy: number } {
  switch (side) {
    case Position.Left:   return { dx: -1, dy: 0 }
    case Position.Right:  return { dx: 1, dy: 0 }
    case Position.Top:    return { dx: 0, dy: -1 }
    case Position.Bottom: return { dx: 0, dy: 1 }
  }
}

function exitStub(p: Point, side: Position, len: number): Point {
  const d = exitDir(side)
  return { x: p.x + d.dx * len, y: p.y + d.dy * len }
}

function entryStub(p: Point, side: Position, len: number): Point {
  // Entry approaches from outside: opposite direction of the side's outward normal
  const d = exitDir(side)
  return { x: p.x - d.dx * len, y: p.y - d.dy * len }
}

function isHorizontal(side: Position): boolean {
  return side === Position.Left || side === Position.Right
}

function isVertical(side: Position): boolean {
  return side === Position.Top || side === Position.Bottom
}

// ── Segment utilities ───────────────────────────────────────────────────────

function segmentCrossesRect(
  a: Point, b: Point,
  r: ObstacleRect,
  tol: number = 2,
): boolean {
  return segmentIntersectsRect(
    a.x, a.y, b.x, b.y,
    r.x - tol, r.y - tol,
    r.w + tol * 2, r.h + tol * 2,
  )
}

function isInsideRect(p: Point, r: ObstacleRect, tol: number = 2): boolean {
  return p.x >= r.x - tol && p.x <= r.x + r.w + tol &&
         p.y >= r.y - tol && p.y <= r.y + r.h + tol
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1x = b.x - a.x, d1y = b.y - a.y
  const d2x = d.x - c.x, d2y = d.y - c.y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false
  const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / cross
  const u = ((c.x - a.x) * d1y - (c.y - a.y) * d1x) / cross
  return t > 0 && t < 1 && u > 0 && u < 1
}

function countBends(points: Point[]): number {
  if (points.length <= 2) return 0
  let n = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1]
    const dx1 = Math.sign(curr.x - prev.x)
    const dy1 = Math.sign(curr.y - prev.y)
    const dx2 = Math.sign(next.x - curr.x)
    const dy2 = Math.sign(next.y - curr.y)
    if (dx1 !== dx2 || dy1 !== dy2) n++
  }
  return n
}

function pathLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y)
  }
  return len
}

function findLongestSegment(points: Point[]): { from: Point; to: Point } {
  if (points.length < 2) return { from: points[0], to: points[0] }
  let best = 0, bestI = 0
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
    if (len > best) { best = len; bestI = i }
  }
  return { from: points[bestI], to: points[bestI + 1] }
}

function midPoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function angleDeg(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
}

function facingSidePenalty(
  sourceRect: ObstacleRect,
  targetRect: ObstacleRect,
  sourceSide: Position,
  targetSide: Position,
): number {
  const sourceCx = sourceRect.x + sourceRect.w / 2
  const sourceCy = sourceRect.y + sourceRect.h / 2
  const targetCx = targetRect.x + targetRect.w / 2
  const targetCy = targetRect.y + targetRect.h / 2
  const horizontal = Math.abs(targetCx - sourceCx) >= Math.abs(targetCy - sourceCy)
  const preferredSource = horizontal
    ? (targetCx >= sourceCx ? Position.Right : Position.Left)
    : (targetCy >= sourceCy ? Position.Bottom : Position.Top)
  const preferredTarget = horizontal
    ? (targetCx >= sourceCx ? Position.Left : Position.Right)
    : (targetCy >= sourceCy ? Position.Top : Position.Bottom)

  return (sourceSide === preferredSource ? 0 : 10000) +
    (targetSide === preferredTarget ? 0 : 10000)
}

// ── Validation helpers ──────────────────────────────────────────────────────

function hasDiagonals(points: Point[]): boolean {
  for (let i = 1; i < points.length; i++) {
    if (points[i].x !== points[i - 1].x && points[i].y !== points[i - 1].y) return true
  }
  return false
}

function minSegmentLen(points: Point[], minLen: number): boolean {
  for (let i = 1; i < points.length; i++) {
    const len = Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y)
    if (len < minLen) return false
  }
  return true
}

function finalSegmentTowardTarget(
  points: Point[],
  targetSide: Position,
  minFinal: number,
): boolean {
  if (points.length < 2) return false
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const len = Math.abs(last.x - prev.x) + Math.abs(last.y - prev.y)
  if (len < minFinal) return false

  // The final segment must approach from the correct direction
  const d = exitDir(targetSide)
  // Entry direction is opposite of exit
  const expectedDx = -d.dx
  const expectedDy = -d.dy
  const actualDx = Math.sign(last.x - prev.x)
  const actualDy = Math.sign(last.y - prev.y)
  return actualDx === expectedDx && actualDy === expectedDy
}

function pathCrossesAnyObstacle(
  points: Point[],
  obstacles: Map<string, ObstacleRect>,
  sourceId: string,
  targetId: string,
  tol: number = 2,
): boolean {
  for (const [id, rect] of obstacles) {
    const isEndpoint = id === sourceId || id === targetId
    const t = isEndpoint ? PORT_OFFSET + 4 : tol
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentCrossesRect(points[i], points[i + 1], rect, t)) {
        const aInside = isInsideRect(points[i], rect, t)
        const bInside = isInsideRect(points[i + 1], rect, t)
        if (aInside && bInside) continue
        // Allow the very first segment to leave through the source body
        if (isEndpoint && rect === [...obstacles.values()].find(o => o === rect)) continue
        return true
      }
    }
  }
  return false
}

function pathCrossesObstacles(
  points: Point[],
  obstacles: Map<string, ObstacleRect>,
  sourceId: string,
  targetId: string,
): string[] {
  const crossed: string[] = []
  const tol = 2
  for (const [id, rect] of obstacles) {
    const isEndpoint = id === sourceId || id === targetId
    const t = isEndpoint ? PORT_OFFSET + 4 : tol
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentCrossesRect(points[i], points[i + 1], rect, t)) {
        const aInside = isInsideRect(points[i], rect, t)
        const bInside = isInsideRect(points[i + 1], rect, t)
        if (aInside && bInside) continue
        crossed.push(id)
        break
      }
    }
  }
  return crossed
}

function countEdgeCrossings(
  points: Point[],
  existingPaths: Point[][],
): number {
  let n = 0
  for (const ep of existingPaths) {
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = 0; j < ep.length - 1; j++) {
        if (segmentsIntersect(points[i], points[i + 1], ep[j], ep[j + 1])) n++
      }
    }
  }
  return n
}

// ── Template generators ─────────────────────────────────────────────────────

function straightTemplate(
  sp: Point, sourceSide: Position,
  tp: Point, targetSide: Position,
  stub: number,
): Point[] | null {
  const exitPt = exitStub(sp, sourceSide, stub)
  const entryPt = entryStub(tp, targetSide, stub)

  // Straight only works if exit and entry are roughly aligned
  const alignedH = isHorizontal(sourceSide) && isHorizontal(targetSide) &&
    Math.abs(exitPt.y - entryPt.y) < 8
  const alignedV = isVertical(sourceSide) && isVertical(targetSide) &&
    Math.abs(exitPt.x - entryPt.x) < 8

  if (!alignedH && !alignedV) return null

  // Face each other: exit direction should point toward entry
  const exD = exitDir(sourceSide)
  const enD = exitDir(targetSide)
  const towardEntry = (exD.dx !== 0 && Math.sign(entryPt.x - exitPt.x) === exD.dx) ||
                      (exD.dy !== 0 && Math.sign(entryPt.y - exitPt.y) === exD.dy)
  if (!towardEntry) return null

  const result = [sp, tp]
  if (exitPt.x !== sp.x || exitPt.y !== sp.y) {
    result.splice(1, 0, exitPt)
  }
  if (entryPt.x !== tp.x || entryPt.y !== tp.y) {
    result.splice(result.length - 1, 0, entryPt)
  }
  // Deduplicate adjacent identical points
  return dedupePoints(result)
}

function dedupePoints(pts: Point[]): Point[] {
  const result: Point[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x !== pts[i - 1].x || pts[i].y !== pts[i - 1].y) {
      result.push(pts[i])
    }
  }
  return result
}

function lShapeTemplate(
  sp: Point, sourceSide: Position,
  tp: Point, targetSide: Position,
  stub: number,
): Point[] | null {
  // L-shape works when one port is horizontal and the other is vertical
  if (isHorizontal(sourceSide) === isHorizontal(targetSide)) return null

  const exitPt = exitStub(sp, sourceSide, stub)
  const entryPt = entryStub(tp, targetSide, stub)

  // Corner is the intersection of the exit axis and entry axis
  const corner = isHorizontal(sourceSide)
    ? { x: entryPt.x, y: exitPt.y }
    : { x: exitPt.x, y: entryPt.y }

  return dedupePoints([sp, exitPt, corner, entryPt, tp])
}

function zShapeTemplate(
  sp: Point, sourceSide: Position,
  tp: Point, targetSide: Position,
  stub: number,
): Point[] | null {
  // Z-shape: both on same orientation
  if (isHorizontal(sourceSide) !== isHorizontal(targetSide)) return null

  const exitPt = exitStub(sp, sourceSide, stub)
  const entryPt = entryStub(tp, targetSide, stub)

  const bothH = isHorizontal(sourceSide)
  const mid1 = bothH
    ? { x: exitPt.x, y: Math.round((exitPt.y + entryPt.y) / 2) }
    : { x: Math.round((exitPt.x + entryPt.x) / 2), y: exitPt.y }
  const mid2 = bothH
    ? { x: entryPt.x, y: mid1.y }
    : { x: mid1.x, y: entryPt.y }

  return dedupePoints([sp, exitPt, mid1, mid2, entryPt, tp])
}

function uShapeTemplate(
  sp: Point, sourceSide: Position,
  tp: Point, targetSide: Position,
  stub: number,
  offset: number = 80,
): Point[] | null {
  // U-shape: go around by extending further in the exit direction, then crossing over
  const exitPt = exitStub(sp, sourceSide, stub)
  const entryPt = entryStub(tp, targetSide, stub)

  const d = exitDir(sourceSide)
  // Extend further in exit direction
  const far1 = { x: exitPt.x + d.dx * offset, y: exitPt.y + d.dy * offset }

  const targetD = exitDir(targetSide)
  // Extend outward from entry (opposite of entry direction)
  const far2 = { x: entryPt.x - targetD.dx * offset, y: entryPt.y - targetD.dy * offset }

  // Now connect far1 to far2 with L or Z
  const mid1 = isHorizontal(sourceSide)
    ? { x: far1.x, y: Math.round((far1.y + far2.y) / 2) }
    : { x: Math.round((far1.x + far2.x) / 2), y: far1.y }
  const mid2 = isHorizontal(sourceSide)
    ? { x: far2.x, y: mid1.y }
    : { x: mid1.x, y: far2.y }

  return dedupePoints([sp, exitPt, far1, mid1, mid2, far2, entryPt, tp])
}

// ── Main planner ────────────────────────────────────────────────────────────

export function planPath(config: PathPlannerConfig): PathResult | null {
  const {
    sourceRect, targetRect, obstacles,
    existingEdgePaths = [],
    stubLength = 32,
    minSegmentLength = 16,
    minFinalSegment = 24,
  } = config

  const allPositions: Position[] = [
    Position.Left, Position.Right,
    Position.Top, Position.Bottom,
  ]

  const allTemplates: Array<{
    name: string
    fn: (sp: Point, ss: Position, tp: Point, ts: Position, stub: number) => Point[] | null
    extraBends?: number
  }> = [
    { name: 'straight', fn: straightTemplate, extraBends: 0 },
    { name: 'lshape', fn: lShapeTemplate, extraBends: 1 },
    { name: 'zshape', fn: zShapeTemplate, extraBends: 2 },
    { name: 'ushape', fn: uShapeTemplate, extraBends: 3 },
  ]

  interface Score {
    sourcePos: Position
    targetPos: Position
    name: string
    points: Point[]
    nodeCrossings: number
    edgeCrossings: number
    bends: number
    length: number
    score: number
  }

  let best: Score | null = null

  const hardObstacles = new Map<string, ObstacleRect>()
  for (const [id, rect] of obstacles) {
    if (rect === sourceRect || rect === targetRect) continue
    hardObstacles.set(id, rect)
  }

  for (const sp of allPositions) {
    for (const tp of allPositions) {
      const sPoint = getPortPoint(sourceRect, sp)
      const tPoint = getPortPoint(targetRect, tp)

      for (const tmpl of allTemplates) {
        const pts = tmpl.fn(sPoint, sp, tPoint, tp, stubLength)
        if (!pts) continue

        // Validate: no diagonals
        if (hasDiagonals(pts)) continue

        // Validate: minimum segment lengths
        if (!minSegmentLen(pts, minSegmentLength)) continue

        // Validate: final segment approaches from correct direction
        if (!finalSegmentTowardTarget(pts, tp, minFinalSegment)) continue

        // Validate: no obstacle crossings
        const crossings = pathCrossesObstacles(pts, hardObstacles, '', '')
        if (crossings.length > 0) continue

        const bends = countBends(pts) + (tmpl.extraBends || 0)
        const len = pathLength(pts)
        const edgeCrossings = countEdgeCrossings(pts, existingEdgePaths)

        // Score: lower is better
        const BEND_PENALTY = 100
        const LENGTH_PENALTY = 1
        const EDGE_CROSS_PENALTY = 50

        const score =
          BEND_PENALTY * bends +
          LENGTH_PENALTY * len +
          EDGE_CROSS_PENALTY * edgeCrossings

        const isBetter =
          !best ||
          bends < best.bends ||
          (bends === best.bends && score < best.score)

        if (isBetter) {
          best = {
            sourcePos: sp,
            targetPos: tp,
            name: tmpl.name,
            points: pts,
            nodeCrossings: 0,
            edgeCrossings,
            bends,
            length: len,
            score,
          }
        }
      }
    }
  }

  if (!best) {
    const fallbackObstacleRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>()
    for (const [id, rect] of hardObstacles) {
      fallbackObstacleRects.set(id, { id, ...rect })
    }

    for (const sp of allPositions) {
      for (const tp of allPositions) {
        const sPoint = getPortPoint(sourceRect, sp)
        const tPoint = getPortPoint(targetRect, tp)
        const pts = getCollisionFreeWaypoints({
          sourceX: sPoint.x,
          sourceY: sPoint.y,
          targetX: tPoint.x,
          targetY: tPoint.y,
          sourcePosition: sp,
          targetPosition: tp,
          nodeRects: fallbackObstacleRects,
          excludedNodeIds: new Set(),
        })

        if (hasDiagonals(pts)) continue

        const crossings = pathCrossesObstacles(pts, hardObstacles, '', '')
        if (crossings.length > 0) continue

        const bends = countBends(pts) + 2
        const len = pathLength(pts)
        const edgeCrossings = countEdgeCrossings(pts, existingEdgePaths)
        const score =
          100 * bends +
          len +
          50 * edgeCrossings +
          facingSidePenalty(sourceRect, targetRect, sp, tp)

        const isBetter =
          !best ||
          score < best.score

        if (isBetter) {
          best = {
            sourcePos: sp,
            targetPos: tp,
            name: 'fallback',
            points: pts,
            nodeCrossings: 0,
            edgeCrossings,
            bends,
            length: len,
            score,
          }
        }
      }
    }
  }

  if (!best) return null

  const labelSeg = findLongestSegment(best.points)
  const borderRadius = 12
  const svgPath = buildSmoothStepSvg(best.points, borderRadius)

  return {
    sourcePort: {
      point: getPortPoint(sourceRect, best.sourcePos),
      side: best.sourcePos,
    },
    targetPort: {
      point: getPortPoint(targetRect, best.targetPos),
      side: best.targetPos,
    },
    points: best.points,
    svgPath,
    score: best.score,
    labelPoint: midPoint(labelSeg.from, labelSeg.to),
    labelAngle: angleDeg(labelSeg.from, labelSeg.to),
    nodeCrossings: best.nodeCrossings,
    edgeCrossings: best.edgeCrossings,
    bends: best.bends,
    length: best.length,
  }
}
