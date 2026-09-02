import type { Edge, Node } from 'reactflow'
import { computeEdgeRoute, isGroupNode, type EdgeRouteDirection } from './edgeRouteBuilder'
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/lib/pipeline-shared/layout/layoutConstants'
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles'

export interface EdgeLabelAnchor {
  x: number
  y: number
  t: number
}

// ── Label sizing ────────────────────────────────────────────────────────────
//
// Labels are rendered small but readable: precision 6.5px, sketch/brutal 8px.
// They use a bounded counter-scale (max ~1.4x) so they stay legible when
// zoomed out without becoming drastically large. To guarantee no overlap we
// reserve world space for the max scaled size.

const LABEL_WIDTH_PER_CHAR = 4.0
const LABEL_HORIZONTAL_PADDING = 8
const LABEL_HEIGHT_CSS = 9
const LABEL_MIN_WIDTH_CSS = 20

// ── Neubrutalism pill sizing ────────────────────────────────────────────────
//
// Brutal now uses 8px (down from 11px), 2px 6px padding, 1.5px border + 2px
// shadow — compact but still brutal. Sketch uses same 8px metrics.
const BRUTAL_WIDTH_PER_CHAR = 4.9
const BRUTAL_HORIZONTAL_PADDING = 12
const BRUTAL_HEIGHT_CSS = 11
const BRUTAL_MIN_WIDTH_CSS = 26
/** Max counter-scale factor. Caps zoom-out growth to keep labels small. */
const LABEL_SAFE_SCALE = 1.5
const BORDER_RADIUS = 24
/**
 * Perpendicular spacing between labels of parallel edges (same source/target
 * pair). Set to 0 so labels sit directly on the edge path per product
 * requirement — edge labels must be on the edge, not offset away by pixels.
 * User-dragged labels (labelT) are also on the path.
 */
const PARALLEL_LABEL_STACK_GAP = 0

function estimateLabelSize(text: string, renderStyle?: DiagramRenderStyleId): { w: number; h: number } {
  const brutal = renderStyle === 'neubrutalism'
  const wpc = brutal ? BRUTAL_WIDTH_PER_CHAR : LABEL_WIDTH_PER_CHAR
  const pad = brutal ? BRUTAL_HORIZONTAL_PADDING : LABEL_HORIZONTAL_PADDING
  const minW = brutal ? BRUTAL_MIN_WIDTH_CSS : LABEL_MIN_WIDTH_CSS
  const cssWidth = Math.max(minW, text.length * wpc + pad)
  return {
    w: cssWidth * LABEL_SAFE_SCALE,
    h: (brutal ? BRUTAL_HEIGHT_CSS : LABEL_HEIGHT_CSS) * LABEL_SAFE_SCALE,
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
  const rawLabel = responseLabel && typeof responseLabel === 'string' && responseLabel.trim()
    ? `${edge.label || data?.label || ''} / ${responseLabel.trim()}`
    : typeof data?.label === 'string'
      ? data.label.trim()
      : typeof edge.label === 'string'
        ? edge.label.trim()
        : ''

  const words = rawLabel ? rawLabel.split(/\s+/).filter(Boolean) : []
  if (words.length === 0) return ''
  const fullLabel = words.length <= 3 ? rawLabel.trim() : words.slice(0, 3).join(' ')
  // Remove trailing slash (handles both "A/" and "A / " cases)
  return fullLabel.replace(/\s*\/\s*$/, '').trim()
}

function getPreferredT(edge: Edge, parallelEdges: Edge[], labelOrder: number): number {
  const data = edge.data as Record<string, unknown> | undefined
  if (typeof data?.labelT === 'number') return data.labelT
  if (parallelEdges.length > 1) {
    return Math.max(0.2, Math.min(0.8, 0.5 + (labelOrder - (parallelEdges.length - 1) / 2) * 0.15))
  }
  return 0.5
}

/**
 * How close (px) two path samples must be to count as a shared / merged corridor.
 * Orthogonal routes that join into one trunk sit on top of each other within a
 * few pixels after the merge corner.
 */
const SHARED_PATH_DIST = 22
const STEM_SAMPLE_COUNT = 48
/** Minimum unique-stem length (fraction of path) before we treat it as usable. */
const MIN_UNIQUE_STEM = 0.12

interface PathSample {
  x: number
  y: number
  t: number
}

function samplePath(segs: PathSegment[], count: number = STEM_SAMPLE_COUNT): PathSample[] {
  const out: PathSample[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const p = pointAtFraction(segs, t)
    out.push({ x: p.x, y: p.y, t })
  }
  return out
}

function sampleNearAny(sample: PathSample, others: PathSample[][], dist: number): boolean {
  for (const pts of others) {
    for (const op of pts) {
      if (Math.hypot(op.x - sample.x, op.y - sample.y) <= dist) return true
    }
  }
  return false
}

/** Fraction of path samples that overlap a peer corridor (fan-in / fan-out merge). */
const MIN_SHARED_PATH_FRACTION = 0.08

/**
 * True when this edge's rendered geometry shares a corridor with a peer — not
 * merely when endpoints touch the same node.
 */
export function pathMergesWithPeers(
  mySamples: PathSample[],
  peerSamples: PathSample[][],
  shareDist: number = SHARED_PATH_DIST,
): boolean {
  if (peerSamples.length === 0 || mySamples.length === 0) return false
  let shared = 0
  for (const sample of mySamples) {
    if (sampleNearAny(sample, peerSamples, shareDist)) shared++
  }
  return shared / mySamples.length >= MIN_SHARED_PATH_FRACTION
}

/**
 * Find how far from the source (and from the target) this path stays unique —
 * i.e. not overlapping another edge's geometry. Fan-in routes share a long
 * trunk near the target; labels belong on the unique stem near the source so
 * each edge keeps a 1:1 label association.
 */
export function findUniqueStemRange(
  mySamples: PathSample[],
  peerSamples: PathSample[][],
  shareDist: number = SHARED_PATH_DIST,
): { uniqueEndFromSource: number; uniqueStartFromTarget: number } {
  if (mySamples.length === 0) {
    return { uniqueEndFromSource: 0.5, uniqueStartFromTarget: 0.5 }
  }

  let uniqueEndFromSource = mySamples[0].t
  for (const sample of mySamples) {
    if (!sampleNearAny(sample, peerSamples, shareDist)) {
      uniqueEndFromSource = sample.t
    } else if (sample.t > MIN_UNIQUE_STEM * 0.5) {
      // First shared sample after leaving the source — stem ends here.
      break
    }
  }

  let uniqueStartFromTarget = mySamples[mySamples.length - 1].t
  for (let i = mySamples.length - 1; i >= 0; i--) {
    const sample = mySamples[i]
    if (!sampleNearAny(sample, peerSamples, shareDist)) {
      uniqueStartFromTarget = sample.t
    } else if (sample.t < 1 - MIN_UNIQUE_STEM * 0.5) {
      break
    }
  }

  return { uniqueEndFromSource, uniqueStartFromTarget }
}

/** Minimum length (px) for a unique line segment to host a label. */
const MIN_LABEL_SEGMENT_LEN = 32
/**
 * Minimum gap (px) between a label pill and a node bounding box.
 * Node clearance uses 1.5x safe scale.
 */
const NODE_LABEL_GAP = 12
const BRUTAL_NODE_LABEL_GAP = 14

function totalPathLength(segs: PathSegment[]): number {
  return segs.reduce((sum, seg) => sum + seg.len, 0)
}

function lineDirection(seg: PathSegment): { dx: number; dy: number } | null {
  if (seg.type !== 'line' || seg.len < 1e-6) return null
  return { dx: Math.sign(seg.x1 - seg.x0), dy: Math.sign(seg.y1 - seg.y0) }
}

/**
 * Collapse consecutive collinear line segments into one run. Orthogonal routes
 * often insert a midpoint waypoint on a straight shot (A → mid → B); treating
 * that as two "first segments" pinned labels against the source node.
 */
function coalesceCollinearLineRuns(
  segs: PathSegment[],
): Array<{ start: number; end: number; len: number }> {
  const runs: Array<{ start: number; end: number; len: number }> = []
  let acc = 0
  let i = 0
  while (i < segs.length) {
    const seg = segs[i]
    const dir = lineDirection(seg)
    if (!dir) {
      acc += seg.len
      i += 1
      continue
    }
    const start = acc
    let end = acc + seg.len
    let j = i + 1
    while (j < segs.length) {
      const next = segs[j]
      const nextDir = lineDirection(next)
      if (!nextDir || nextDir.dx !== dir.dx || nextDir.dy !== dir.dy) break
      end += next.len
      j += 1
    }
    runs.push({ start, end, len: end - start })
    acc = end
    i = j
  }
  return runs
}

/**
 * Arc-length fraction range of the first long unique collinear run after the
 * source (fan-in) or before the target (fan-out). Collinear mid-waypoints are
 * merged so a straight edge is one run (labels sit mid-gap, not flush to the
 * node). L-shaped fan-in still uses the private vertical/horizontal drop.
 */
export function uniqueSegmentTRange(
  segs: PathSegment[],
  stem: { uniqueEndFromSource: number; uniqueStartFromTarget: number },
  preferSourceStem: boolean,
): { lo: number; hi: number; mid: number } | null {
  const total = totalPathLength(segs)
  if (total <= 0) return null
  const runs = coalesceCollinearLineRuns(segs)

  if (preferSourceStem) {
    const uniqueEndLen = stem.uniqueEndFromSource * total
    for (const run of runs) {
      if (run.start >= uniqueEndLen - 1) break
      if (run.len < MIN_LABEL_SEGMENT_LEN) continue
      const usableEnd = Math.min(run.end, uniqueEndLen)
      const usableLen = usableEnd - run.start
      if (usableLen >= MIN_LABEL_SEGMENT_LEN * 0.6) {
        const lo = run.start / total
        const hi = usableEnd / total
        // Center the run; slight source bias only when the unique stem is a
        // short private drop (fan-in), not the whole edge.
        const bias = stem.uniqueEndFromSource < 0.85 ? 0.45 : 0.5
        const mid = (run.start + usableLen * bias) / total
        return { lo: lo + 0.01, hi: Math.max(lo + 0.02, hi - 0.02), mid }
      }
    }
    return null
  }

  const uniqueStartLen = stem.uniqueStartFromTarget * total
  let best: { lo: number; hi: number; mid: number } | null = null
  for (const run of runs) {
    if (run.end <= uniqueStartLen + 1) continue
    if (run.len < MIN_LABEL_SEGMENT_LEN) continue
    const usableStart = Math.max(run.start, uniqueStartLen)
    const usableLen = run.end - usableStart
    if (usableLen >= MIN_LABEL_SEGMENT_LEN * 0.6) {
      const lo = usableStart / total
      const hi = run.end / total
      const bias = 1 - stem.uniqueStartFromTarget < 0.85 ? 0.55 : 0.5
      const mid = (usableStart + usableLen * bias) / total
      best = { lo: lo + 0.01, hi: Math.max(lo + 0.02, hi - 0.02), mid }
    }
  }
  return best
}

/**
 * Prefer a label on the first private path segment (fan-in) or last private
 * segment (fan-out). Falls back to the parallel/midpoint heuristic.
 */
export function preferredTForUniqueStem(
  edge: Edge,
  parallelEdges: Edge[],
  labelOrder: number,
  stem: { uniqueEndFromSource: number; uniqueStartFromTarget: number },
  segs?: PathSegment[],
): number {
  const data = edge.data as Record<string, unknown> | undefined
  if (typeof data?.labelT === 'number') return data.labelT

  const fromSourceLen = stem.uniqueEndFromSource
  const fromTargetLen = 1 - stem.uniqueStartFromTarget

  if (segs && fromSourceLen >= MIN_UNIQUE_STEM && fromSourceLen >= fromTargetLen) {
    const range = uniqueSegmentTRange(segs, stem, true)
    if (range) return Math.max(0.06, Math.min(0.85, range.mid))
  }

  if (segs && fromTargetLen >= MIN_UNIQUE_STEM) {
    const range = uniqueSegmentTRange(segs, stem, false)
    if (range) return Math.max(0.15, Math.min(0.94, range.mid))
  }

  // Legacy stem midpoint if segment picking failed.
  if (fromSourceLen >= MIN_UNIQUE_STEM && fromSourceLen >= fromTargetLen) {
    const lo = 0.08
    const hi = Math.max(lo + 0.04, stem.uniqueEndFromSource * 0.5)
    return Math.max(0.08, Math.min(0.5, (lo + hi) / 2))
  }

  if (fromTargetLen >= MIN_UNIQUE_STEM) {
    const lo = Math.min(0.92, 0.5 + stem.uniqueStartFromTarget * 0.5)
    const hi = 0.92
    return Math.max(0.5, Math.min(0.92, (lo + hi) / 2))
  }

  return getPreferredT(edge, parallelEdges, labelOrder)
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
  segs: PathSegment[]
  basePerp: number
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

function buildCandidates(
  segs: PathSegment[],
  preferredT: number,
  perpOffset: number,
  /** When set, prefer / search this range first (unique stem). */
  preferredRange?: { lo: number; hi: number },
  renderStyle?: DiagramRenderStyleId,
): LabelCandidate[] {
  const mk = (t: number): LabelCandidate => {
    const base = pointAtFraction(segs, t)
    const off = offsetPerpendicular(segs, t, perpOffset)
    return { t, x: base.x + off.x, y: base.y + off.y }
  }
  const candidates: LabelCandidate[] = [mk(preferredT)]
  const STEP = 0.01
  // Keep labels away from arrowhead / source tip: at least 15% from ends
  // prevents "label too close to marker" on short edges or bends near target.
  // Also enforce 28px world-space gap from target (arrowhead) for short edges
  // where 15% is still < arrow size.
  // Neubrutalism's pill + hard shadow + larger arrowhead need more clearance
  // so the label never sits on the marker.
  const brutal = renderStyle === 'neubrutalism'
  const totalLen = segs.reduce((s, seg) => s + seg.len, 0)
  const minDistFromEnds = brutal ? 44 : 28
  const tMarginCap = brutal ? 0.22 : 0.18
  const tMargin = totalLen > 1 ? Math.min(tMarginCap, minDistFromEnds / totalLen) : 0.15
  const lo = preferredRange ? Math.max(tMargin, preferredRange.lo) : tMargin
  const hi = preferredRange ? Math.min(1 - tMargin, preferredRange.hi) : 1 - tMargin

  // Prefer unique-stem samples first, then fall back to the full path so
  // collision resolution can still escape a crowded stem.
  for (let t = lo; t <= hi + 1e-9; t += STEP) {
    candidates.push(mk(t))
  }
  if (preferredRange) {
    for (let t = 0.05; t <= 0.95 + 1e-9; t += STEP) {
      if (t >= lo && t <= hi) continue
      candidates.push(mk(t))
    }
  }

  candidates.sort((a, b) => {
    const inRange = (t: number) =>
      !preferredRange || (t >= lo - 1e-9 && t <= hi + 1e-9)
    const aIn = inRange(a.t)
    const bIn = inRange(b.t)
    if (aIn !== bIn) return aIn ? -1 : 1
    const da = Math.abs(a.t - preferredT)
    const db = Math.abs(b.t - preferredT)
    if (da !== db) return da - db
    return Math.abs(a.t - 0.5) - Math.abs(b.t - 0.5)
  })
  return candidates
}

interface RoutedEdge {
  edge: Edge
  segs: PathSegment[]
  samples: PathSample[]
  label: string
}

function computeLayout(
  edges: Edge[],
  nodeInternals: ReadonlyMap<string, Node>,
  direction: EdgeRouteDirection,
  renderStyle?: DiagramRenderStyleId,
): Map<string, EdgeLabelAnchor> {
  const nodes = Array.from(nodeInternals.values())
  const brutal = renderStyle === 'neubrutalism'
  const nodeGap = brutal ? BRUTAL_NODE_LABEL_GAP : NODE_LABEL_GAP

  // Inflate node boxes so label pills keep a visible gap from node borders.
  // Group containers are not label obstacles: edges and their labels legally
  // cross subgraph boundaries, so a label may sit on/over a group box.
  const nodeObstacles: PlacedRect[] = nodes
    .filter((n) => !isGroupNode(n))
    .map((n) => {
      const w = n.width ?? DEFAULT_NODE_WIDTH
      const h = n.height ?? DEFAULT_NODE_HEIGHT
      const x = (n.positionAbsolute?.x ?? n.position.x) - nodeGap
      const y = (n.positionAbsolute?.y ?? n.position.y) - nodeGap
      return { x, y, w: w + 2 * nodeGap, h: h + 2 * nodeGap }
    })

  // Pass 1: route every edge so fan-in/fan-out sharing can be detected even
  // against unlabeled siblings that occupy the same corridor.
  const routed: RoutedEdge[] = []
  for (const edge of edges) {
    const route = computeEdgeRoute(edge, nodes, edges, direction)
    if (!route.waypoints || route.waypoints.length < 2) continue
    const segs = buildPathSegments(route.waypoints)
    if (segs.length === 0) continue
    routed.push({
      edge,
      segs,
      samples: samplePath(segs),
      label: getDisplayLabel(edge),
    })
  }

  const workItems: LabelWorkItem[] = []
  for (const item of routed) {
    if (!item.label) continue
    const { edge, segs } = item

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

    // Peers for sharing: other routed edges (especially same target / source).
    // Prefer same-endpoint peers so unrelated crossings don't end the stem early.
    const sameEndpointPeers = routed
      .filter(
        (r) =>
          r.edge.id !== edge.id &&
          (r.edge.target === edge.target ||
            r.edge.source === edge.source ||
            r.edge.target === edge.source ||
            r.edge.source === edge.target),
      )
      .map((r) => r.samples)
    const peerSamples =
      sameEndpointPeers.length > 0
        ? sameEndpointPeers
        : routed.filter((r) => r.edge.id !== edge.id).map((r) => r.samples)

    const pathMerges = pathMergesWithPeers(item.samples, peerSamples)
    const stem = pathMerges
      ? findUniqueStemRange(item.samples, peerSamples)
      : { uniqueEndFromSource: 0.5, uniqueStartFromTarget: 0.5 }
    const preferredT = pathMerges
      ? preferredTForUniqueStem(edge, parallelEdges, labelOrder, stem, segs)
      : getPreferredT(edge, parallelEdges, labelOrder)

    let preferredRange: { lo: number; hi: number } | undefined
    if (pathMerges && typeof data?.labelT !== 'number') {
      const fromSourceLen = stem.uniqueEndFromSource
      const fromTargetLen = 1 - stem.uniqueStartFromTarget
      if (fromSourceLen >= MIN_UNIQUE_STEM && fromSourceLen >= fromTargetLen) {
        const segRange = uniqueSegmentTRange(segs, stem, true)
        preferredRange = segRange
          ? { lo: segRange.lo, hi: segRange.hi }
          : { lo: 0.06, hi: Math.max(0.12, Math.min(0.45, stem.uniqueEndFromSource * 0.55)) }
      } else if (fromTargetLen >= MIN_UNIQUE_STEM) {
        const segRange = uniqueSegmentTRange(segs, stem, false)
        preferredRange = segRange
          ? { lo: segRange.lo, hi: segRange.hi }
          : {
              lo: Math.min(0.88, Math.max(0.55, stem.uniqueStartFromTarget + 0.02)),
              hi: 0.94,
            }
      }
    }

    const preferredBase = pointAtFraction(segs, preferredT)
    const preferredOff = offsetPerpendicular(segs, preferredT, perpOffset)
    const preferred = { x: preferredBase.x + preferredOff.x, y: preferredBase.y + preferredOff.y }

    workItems.push({
      edgeId: edge.id,
      preferredT,
      size: estimateLabelSize(item.label, renderStyle),
      segs,
      basePerp: perpOffset,
      candidates: buildCandidates(segs, preferredT, perpOffset, preferredRange, renderStyle),
      sortX: preferred.x,
      sortY: preferred.y,
    })
  }

  // Deterministic processing order: reading order (top-to-bottom, left-to-right).
  workItems.sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX)

  const placed: PlacedRect[] = []
  const result = new Map<string, EdgeLabelAnchor>()
  /**
   * Labels must sit directly on the edge path — no perpendicular escape.
   * Previous ladder [0,22,-22,...,128,-128] offset labels away from the wire
   * to avoid node overlaps, but product requirement is edge labels on the edge.
   */
  const NODE_ESCAPE_PERPS = [0]

  for (const item of workItems) {
    const pointFor = (t: number, perp: number): LabelCandidate => {
      const base = pointAtFraction(item.segs, t)
      const off = offsetPerpendicular(item.segs, t, item.basePerp + perp)
      return { t, x: base.x + off.x, y: base.y + off.y }
    }
    const cssRectAt = (cand: LabelCandidate): PlacedRect => ({
      x: cand.x - item.size.w / 2,
      y: cand.y - item.size.h / 2,
      w: item.size.w,
      h: item.size.h,
    })
    const clearOfNodes = (cand: LabelCandidate) =>
      !nodeObstacles.some((n) => rectsOverlap(n, cssRectAt(cand)))
    const clearOfLabels = (cand: LabelCandidate) => {
      const rect = { x: cand.x - item.size.w / 2, y: cand.y - item.size.h / 2, w: item.size.w, h: item.size.h }
      return !placed.some((p) => rectsOverlap(p, rect))
    }

    let chosen: LabelCandidate | null = null
    for (const escape of NODE_ESCAPE_PERPS) {
      for (const base of item.candidates) {
        const cand = escape === 0 ? base : pointFor(base.t, escape)
        if (clearOfLabels(cand) && clearOfNodes(cand)) {
          chosen = cand
          break
        }
      }
      if (chosen) break
    }
    // Overlapping a node is worse than touching another label, so when no
    // candidate clears both, prefer staying off the node even at the cost of a
    // label-label overlap; only fall back to label-clear as a last resort.
    if (!chosen) {
      for (const cand of item.candidates) {
        if (clearOfNodes(cand)) {
          chosen = cand
          break
        }
      }
    }
    if (!chosen) {
      for (const cand of item.candidates) {
        if (clearOfLabels(cand)) {
          chosen = cand
          break
        }
      }
    }
    if (!chosen) chosen = item.candidates[0]

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
  renderStyle?: DiagramRenderStyleId
  result: Map<string, EdgeLabelAnchor>
}

const layoutCache = new Map<Edge[], CacheEntry>()
const CACHE_MAX = 8

export function computeEdgeLabelLayout(
  edges: Edge[],
  nodeInternals: ReadonlyMap<string, Node>,
  direction: EdgeRouteDirection,
  renderStyle?: DiagramRenderStyleId,
): ReadonlyMap<string, EdgeLabelAnchor> {
  const hit = layoutCache.get(edges)
  if (hit && hit.nodeInternals === nodeInternals && hit.direction === direction && hit.renderStyle === renderStyle) {
    return hit.result
  }

  const result = computeLayout(edges, nodeInternals, direction, renderStyle)
  layoutCache.set(edges, { nodeInternals, direction, renderStyle, result })
  if (layoutCache.size > CACHE_MAX) {
    const oldest = layoutCache.keys().next().value
    if (oldest !== undefined) layoutCache.delete(oldest)
  }
  return result
}
