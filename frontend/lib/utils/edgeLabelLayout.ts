import { Edge, Node } from 'reactflow'
import { computeEdgeRoute, type EdgeRouteDirection } from './edgeRouteBuilder'

export interface EdgeLabelAnchor {
  x: number
  y: number
  t: number
}

// ── Label sizing ────────────────────────────────────────────────────────────
//
// Labels are counter-scaled with zoom (labelScale = clamp(1/zoom, 1, 2)) so
// they stay legible when zoomed out. To guarantee two labels never overlap on
// screen at ANY zoom level we reserve, in world space, twice the CSS size of
// the pill: the rendered world size is at most 2x CSS (worst case zoom 0.5),
// so two world rects that do not intersect can never intersect on screen.

const LABEL_WIDTH_PER_CHAR = 6
const LABEL_HORIZONTAL_PADDING = 12
const LABEL_HEIGHT_CSS = 14
const LABEL_MIN_WIDTH_CSS = 30
/** Max counter-scale factor (labelScale cap). Doubles the reserved rect. */
const LABEL_SAFE_SCALE = 2
const BORDER_RADIUS = 24
/**
 * Perpendicular spacing between labels of parallel edges (same source/target
 * pair). Parallel edges often render as identical lines, so fanning the label
 * t-position alone cannot separate their pills; they are stacked at right
 * angles to the path instead. Must be >= reserved label height (2 * 14 = 28)
 * to guarantee non-overlap. User-dragged labels (labelT) are not stacked.
 */
const PARALLEL_LABEL_STACK_GAP = 32

function estimateLabelSize(text: string): { w: number; h: number } {
  const cssWidth = Math.max(LABEL_MIN_WIDTH_CSS, text.length * LABEL_WIDTH_PER_CHAR + LABEL_HORIZONTAL_PADDING)
  return {
    w: cssWidth * LABEL_SAFE_SCALE,
    h: LABEL_HEIGHT_CSS * LABEL_SAFE_SCALE,
  }
}

// ── Smooth orthogonal path, mirrored from collisionFreeEdgePath ────────────
//
// computeEdgeRoute produces waypoints that are rendered via buildSmoothStepSvg
// (straight segments + circular corner arcs). To place labels exactly on the
// rendered curve without touching the DOM we rebuild the same geometry as
// segments and sample it by arc length, matching getPointOnPath's behaviour.

interface PathSegment {
  type: 'line' | 'arc'
  x0: number
  y0: number
  x1: number
  y1: number
  len: number
  cx?: number
  cy?: number
  r?: number
  a0?: number
  d?: number
}

export function buildPathSegments(points: Array<{ x: number; y: number }>): PathSegment[] {
  const cleaned: Array<{ x: number; y: number }> = []
  for (const pt of points) {
    if (cleaned.length === 0) {
      cleaned.push(pt)
    } else {
      const last = cleaned[cleaned.length - 1]
      if (Math.abs(pt.x - last.x) > 0.01 || Math.abs(pt.y - last.y) > 0.01) {
        cleaned.push(pt)
      }
    }
  }
  if (cleaned.length < 2) return []

  const segs: PathSegment[] = []
  let prev = cleaned[0]

  for (let i = 1; i < cleaned.length - 1; i++) {
    const curr = cleaned[i]
    const next = cleaned[i + 1]

    const dx1 = Math.sign(curr.x - prev.x)
    const dy1 = Math.sign(curr.y - prev.y)
    const dx2 = Math.sign(next.x - curr.x)
    const dy2 = Math.sign(next.y - curr.y)

    if (dx1 === dx2 && dy1 === dy2) {
      segs.push({ type: 'line', x0: prev.x, y0: prev.y, x1: curr.x, y1: curr.y, len: Math.hypot(curr.x - prev.x, curr.y - prev.y) })
      prev = curr
      continue
    }

    const distPrev = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y)
    const distNext = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y)
    const r = Math.max(0, Math.min(BORDER_RADIUS, distPrev / 2, distNext / 2))

    if (r <= 0) {
      segs.push({ type: 'line', x0: prev.x, y0: prev.y, x1: curr.x, y1: curr.y, len: Math.hypot(curr.x - prev.x, curr.y - prev.y) })
      prev = curr
      continue
    }

    let arcStartX = curr.x
    let arcStartY = curr.y
    let arcEndX = curr.x
    let arcEndY = curr.y

    if (prev.x === curr.x) {
      arcStartY = curr.y + (prev.y > curr.y ? r : -r)
      arcStartX = curr.x
    } else {
      arcStartX = curr.x + (prev.x > curr.x ? r : -r)
      arcStartY = curr.y
    }

    if (next.x === curr.x) {
      arcEndY = curr.y + (next.y > curr.y ? r : -r)
      arcEndX = curr.x
    } else {
      arcEndX = curr.x + (next.x > curr.x ? r : -r)
      arcEndY = curr.y
    }

    segs.push({
      type: 'line',
      x0: prev.x,
      y0: prev.y,
      x1: arcStartX,
      y1: arcStartY,
      len: Math.hypot(arcStartX - prev.x, arcStartY - prev.y),
    })

    const v1x = curr.x - arcStartX
    const v1y = curr.y - arcStartY
    const v2x = arcEndX - curr.x
    const v2y = arcEndY - curr.y
    const sweep = v1x * v2y - v1y * v2x > 0 ? 1 : 0

    // The arc center is the intersection of the perpendicular through the arc
    // start (normal to the incoming leg) and the perpendicular through the arc
    // end (normal to the outgoing leg), not the corner point itself.
    const cx = prev.y === curr.y ? arcStartX : arcEndX
    const cy = prev.x === curr.x ? arcStartY : arcEndY

    const a0 = Math.atan2(arcStartY - cy, arcStartX - cx)
    const a1 = Math.atan2(arcEndY - cy, arcEndX - cx)
    let d = a1 - a0
    while (d <= -Math.PI) d += 2 * Math.PI
    while (d > Math.PI) d -= 2 * Math.PI
    // sweep=1 -> the short arc is drawn with increasing angle; sweep=0 with
    // decreasing angle (verified against buildSmoothStepSvg output).
    if (sweep === 1 && d < 0) d += 2 * Math.PI
    else if (sweep === 0 && d > 0) d -= 2 * Math.PI

    // Degenerate 180° corner (arc start == arc end, e.g. a dragged waypoint
    // that reverses the path). buildSmoothStepSvg emits a zero-length arc, so
    // render it as a sharp corner through arcStart.
    if (Math.hypot(arcEndX - arcStartX, arcEndY - arcStartY) < 1) {
      prev = { x: arcStartX, y: arcStartY }
      continue
    }

    segs.push({
      type: 'arc',
      x0: arcStartX,
      y0: arcStartY,
      x1: arcEndX,
      y1: arcEndY,
      len: Math.abs(d) * r,
      cx,
      cy,
      r,
      a0,
      d,
    })

    prev = { x: arcEndX, y: arcEndY }
  }

  segs.push({
    type: 'line',
    x0: prev.x,
    y0: prev.y,
    x1: cleaned[cleaned.length - 1].x,
    y1: cleaned[cleaned.length - 1].y,
    len: Math.hypot(cleaned[cleaned.length - 1].x - prev.x, cleaned[cleaned.length - 1].y - prev.y),
  })

  return segs
}

export function pointAtFraction(segs: PathSegment[], f: number): { x: number; y: number } {
  if (segs.length === 0) return { x: 0, y: 0 }
  const total = segs.reduce((sum, seg) => sum + seg.len, 0)
  if (total <= 0) return { x: segs[0].x0, y: segs[0].y0 }

  let target = total * Math.max(0, Math.min(1, f))
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (target <= seg.len || i === segs.length - 1) {
      if (seg.type === 'line') {
        const u = seg.len > 0 ? Math.max(0, Math.min(1, target / seg.len)) : 0
        return { x: seg.x0 + (seg.x1 - seg.x0) * u, y: seg.y0 + (seg.y1 - seg.y0) * u }
      }
      const u = seg.len > 0 ? Math.max(0, Math.min(1, target / seg.len)) : 0
      const theta = (seg.a0 ?? 0) + (seg.d ?? 0) * u
      return { x: (seg.cx ?? 0) + (seg.r ?? 0) * Math.cos(theta), y: (seg.cy ?? 0) + (seg.r ?? 0) * Math.sin(theta) }
    }
    target -= seg.len
  }
  const last = segs[segs.length - 1]
  return { x: last.x1, y: last.y1 }
}

// ── Label text & preferred position (mirrors SimpleFloatingEdge) ───────────

function getDisplayLabel(edge: Edge): string {
  const data = edge.data as Record<string, unknown> | undefined
  const responseLabel = data?.responseLabel
  const rawLabel = responseLabel
    ? `${edge.label || data?.label || ''} / ${responseLabel}`
    : typeof data?.label === 'string'
      ? data.label.trim()
      : typeof edge.label === 'string'
        ? edge.label.trim()
        : ''

  const words = rawLabel ? rawLabel.split(/\s+/).filter(Boolean) : []
  if (words.length === 0) return ''
  return words.length <= 3 ? rawLabel.trim() : words.slice(0, 3).join(' ')
}

function getPreferredT(edge: Edge, parallelEdges: Edge[], labelOrder: number): number {
  const data = edge.data as Record<string, unknown> | undefined
  if (typeof data?.labelT === 'number') return data.labelT
  if (parallelEdges.length > 1) {
    return Math.max(0.2, Math.min(0.8, 0.5 + (labelOrder - (parallelEdges.length - 1) / 2) * 0.15))
  }
  return 0.5
}

// ── Collision resolution ───────────────────────────────────────────────────

interface PlacedRect {
  x: number
  y: number
  w: number
  h: number
}

function rectsOverlap(a: PlacedRect, b: PlacedRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

interface LabelCandidate {
  t: number
  x: number
  y: number
}

interface LabelWorkItem {
  edgeId: string
  preferredT: number
  size: { w: number; h: number }
  candidates: LabelCandidate[]
  sortX: number
  sortY: number
}

function offsetPerpendicular(segs: PathSegment[], t: number, offset: number): { x: number; y: number } {
  if (Math.abs(offset) < 1e-6) return { x: 0, y: 0 }
  const ta = pointAtFraction(segs, Math.max(0, t - 0.002))
  const tb = pointAtFraction(segs, Math.min(1, t + 0.002))
  const dx = tb.x - ta.x
  const dy = tb.y - ta.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: 0, y: 0 }
  return { x: (-dy / len) * offset, y: (dx / len) * offset }
}

function buildCandidates(segs: PathSegment[], preferredT: number, perpOffset: number): LabelCandidate[] {
  const mk = (t: number): LabelCandidate => {
    const base = pointAtFraction(segs, t)
    const off = offsetPerpendicular(segs, t, perpOffset)
    return { t, x: base.x + off.x, y: base.y + off.y }
  }
  const candidates: LabelCandidate[] = [mk(preferredT)]
  const STEP = 0.01
  for (let t = 0.05; t <= 0.95 + 1e-9; t += STEP) {
    candidates.push(mk(t))
  }
  candidates.sort((a, b) => {
    const da = Math.abs(a.t - preferredT)
    const db = Math.abs(b.t - preferredT)
    if (da !== db) return da - db
    return Math.abs(a.t - 0.5) - Math.abs(b.t - 0.5)
  })
  return candidates
}

function computeLayout(
  edges: Edge[],
  nodeInternals: ReadonlyMap<string, Node>,
  direction: EdgeRouteDirection,
): Map<string, EdgeLabelAnchor> {
  const nodes = Array.from(nodeInternals.values())

  const workItems: LabelWorkItem[] = []
  for (const edge of edges) {
    const label = getDisplayLabel(edge)
    if (!label) continue

    const route = computeEdgeRoute(edge, nodes, edges, direction)
    if (!route.waypoints || route.waypoints.length < 2) continue

    const segs = buildPathSegments(route.waypoints)
    if (segs.length === 0) continue

    const parallelEdges = edges
      .filter(
        (e) =>
          (e.source === edge.source && e.target === edge.target) ||
          (e.source === edge.target && e.target === edge.source),
      )
      .sort((a, b) => a.id.localeCompare(b.id))

    const labelOrder = Math.max(0, parallelEdges.findIndex((e) => e.id === edge.id))
    const data = edge.data as Record<string, unknown> | undefined
    const perpOffset =
      parallelEdges.length > 1 && typeof data?.labelT !== 'number'
        ? (labelOrder - (parallelEdges.length - 1) / 2) * PARALLEL_LABEL_STACK_GAP
        : 0

    const preferredT = getPreferredT(edge, parallelEdges, labelOrder)
    const preferredBase = pointAtFraction(segs, preferredT)
    const preferredOff = offsetPerpendicular(segs, preferredT, perpOffset)
    const preferred = { x: preferredBase.x + preferredOff.x, y: preferredBase.y + preferredOff.y }

    workItems.push({
      edgeId: edge.id,
      preferredT,
      size: estimateLabelSize(label),
      candidates: buildCandidates(segs, preferredT, perpOffset),
      sortX: preferred.x,
      sortY: preferred.y,
    })
  }

  // Deterministic processing order: reading order (top-to-bottom, left-to-right).
  workItems.sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX)

  const placed: PlacedRect[] = []
  const result = new Map<string, EdgeLabelAnchor>()

  for (const item of workItems) {
    let chosen = item.candidates[0]
    for (const cand of item.candidates) {
      const rect = { x: cand.x - item.size.w / 2, y: cand.y - item.size.h / 2, w: item.size.w, h: item.size.h }
      if (!placed.some((p) => rectsOverlap(p, rect))) {
        chosen = cand
        break
      }
    }
    placed.push({ x: chosen.x - item.size.w / 2, y: chosen.y - item.size.h / 2, w: item.size.w, h: item.size.h })
    result.set(item.edgeId, { x: chosen.x, y: chosen.y, t: chosen.t })
  }

  return result
}

// ── Shared memoisation ─────────────────────────────────────────────────────
//
// Every SimpleFloatingEdge computes label positions during the same render.
// Routing is the expensive part, so we run the layout once per diagram state
// and reuse it for all edges. Keyed by reference identity: the diagram store
// (and React Flow's nodeInternals) allocate fresh objects on any mutation, so
// matching references means identical geometry.

interface CacheEntry {
  nodeInternals: ReadonlyMap<string, Node>
  direction: EdgeRouteDirection
  result: Map<string, EdgeLabelAnchor>
}

const layoutCache = new Map<Edge[], CacheEntry>()
const CACHE_MAX = 8

export function computeEdgeLabelLayout(
  edges: Edge[],
  nodeInternals: ReadonlyMap<string, Node>,
  direction: EdgeRouteDirection,
): ReadonlyMap<string, EdgeLabelAnchor> {
  const hit = layoutCache.get(edges)
  if (hit && hit.nodeInternals === nodeInternals && hit.direction === direction) {
    return hit.result
  }

  const result = computeLayout(edges, nodeInternals, direction)
  layoutCache.set(edges, { nodeInternals, direction, result })
  if (layoutCache.size > CACHE_MAX) {
    const oldest = layoutCache.keys().next().value
    if (oldest !== undefined) layoutCache.delete(oldest)
  }
  return result
}
