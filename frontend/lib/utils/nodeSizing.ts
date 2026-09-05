/**
 * Node dimension helpers — snap to the optical size grid (160 / 200 / 240).
 * Prefer wrapping long labels over growing past SIZE_L; diamonds/circles size
 * from their usable mid-band so silhouettes stay compact.
 */

import { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid, SHAPE_LANE_HEIGHT_CAP, ICON_SIZE } from '@/lib/theme/stylingConstants';

/** Soft ceiling for rare callers that opt into wider cards. */
export const SIZE_XL = 280;
/** Absolute ceiling — kept for API compat; default sizing stays on the L grid. */
export const SIZE_XXL = 320;
/** Compact entry-point nodes (actors, phones) sit below the standard grid. */
export const SIZE_XS = 120;

const AVG_CHAR_WIDTH = 7.2; // ~13–14px semibold
const LINE_HEIGHT = 18;
const PADDING_Y = 32;
const MIN_HEIGHT = 100;
/** Vertical room for icon above label — keep aligned with ICON_SIZE.box. */
const ICON_STACK = ICON_SIZE.box + 12;

export type ShapeFit =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'diamond'
  | 'cylinder'
  | 'circle'
  | 'parallelogram'
  | 'hexagon'
  | 'cloud'
  | 'actor'
  | 'monitor'
  | 'mobile'
  | 'dashed-rectangle'
  // Architecture-native semantic silhouettes (Phase 1)
  | 'queue'
  | 'cache'
  | 'function'
  | 'container'
  | 'bucket'
  | 'document'
  | 'documents';

/**
 * Fraction of bbox width usable for wrapped label text.
 * Must stay aligned with ShapeNode `resolveShapeSize` band values.
 */
const SHAPE_TEXT_BAND: Record<ShapeFit, number> = {
  rectangle: 0.88,
  'rounded-rectangle': 0.88,
  diamond: 0.42,
  parallelogram: 0.72,
  circle: 0.42,
  cylinder: 0.85,
  hexagon: 0.58,
  cloud: 0.8,
  actor: 0.68,
  monitor: 0.72,
  mobile: 0.56,
  'dashed-rectangle': 0.88,
  // New architecture-native shapes
  queue: 0.78,
  cache: 0.7,
  'function': 0.68,
  container: 0.76,
  bucket: 0.72,
  document: 0.78,
  documents: 0.75,
};

/** Mild height padding for non-rect silhouettes (not a large multiplier). */
const SHAPE_HEIGHT_FACTOR: Record<ShapeFit, number> = {
  rectangle: 0.92,
  'rounded-rectangle': 0.92,
  diamond: 1.12,
  parallelogram: 1.05,
  circle: 1.1,
  cylinder: 0.93,
  hexagon: 1.12,
  cloud: 1.12,
  actor: 1.1,
  monitor: 1.1,
  mobile: 1.1,
  'dashed-rectangle': 1,
  // New architecture-native shapes
  queue: 1,
  cache: 1.08,
  'function': 1.08,
  container: 1.08,
  bucket: 1.1,
  document: 1.4,  // Taller portrait orientation
  documents: 1.4, // Taller portrait orientation
};

/** Legacy compact icon stack for diamonds (excluded from enlarged icons). */
const DIAMOND_ICON_STACK = ICON_SIZE.diamond.box + 8;

/** 
 * Default max width: preferred maximum, but can grow larger for content.
 * This is a soft limit - nodes will expand beyond this if content requires it.
 */
const SHAPE_PREFERRED_MAX_WIDTH: Record<ShapeFit, number> = {
  rectangle: SIZE_L,
  'rounded-rectangle': SIZE_L,
  diamond: SIZE_L,
  parallelogram: SIZE_L,
  circle: SIZE_L,
  cylinder: SIZE_L,
  hexagon: SIZE_L,
  cloud: SIZE_L,
  actor: SIZE_S,
  monitor: SIZE_L,
  mobile: SIZE_S,
  'dashed-rectangle': SIZE_L,
  // New architecture-native shapes
  queue: SIZE_L,
  cache: SIZE_M,
  'function': SIZE_M,
  container: SIZE_L,
  bucket: SIZE_M,
  document: 150,  // Increased width for better readability
  documents: 150,
};

/**
 * Absolute maximum width to prevent nodes from becoming too large.
 * Only enforced when content is extremely long.
 */
const SHAPE_ABSOLUTE_MAX_WIDTH: Record<ShapeFit, number> = {
  rectangle: SIZE_XXL * 2,  // 640px
  'rounded-rectangle': SIZE_XXL * 2,
  diamond: SIZE_XXL,  // 320px (smaller due to shape constraints)
  parallelogram: SIZE_XXL * 2,
  circle: SIZE_XXL,  // 320px (smaller due to shape constraints)
  cylinder: SIZE_XXL * 2,
  hexagon: SIZE_XXL,
  cloud: SIZE_XXL * 1.5,
  actor: SIZE_M,  // Keep compact
  monitor: SIZE_XXL * 2,
  mobile: SIZE_M,  // Keep compact
  'dashed-rectangle': SIZE_XXL * 2,
  // New architecture-native shapes
  queue: SIZE_XXL * 2,
  cache: SIZE_XXL,
  'function': SIZE_XXL,
  container: SIZE_XXL * 2,
  bucket: SIZE_XXL,
  document: 260,  // +30% (was 200)
  documents: 260, // +30% (was 200)
};

/**
 * Min width per shape — one unified scale so every creation path (palette, AI,
 * Mermaid, quick-add drafts) produces identically sized nodes.
 * Rect / rounded-rect are intentionally wider to read as horizontal bars, not squares.
 */
const SHAPE_MIN_WIDTH: Record<ShapeFit, number> = {
  rectangle: SIZE_M,
  'rounded-rectangle': SIZE_M,
  diamond: 140,
  parallelogram: 160,
  circle: 120,
  cylinder: 160,
  hexagon: 160,
  cloud: 160,
  actor: SIZE_XS,
  monitor: 160,
  mobile: SIZE_XS,
  'dashed-rectangle': 160,
  // New architecture-native shapes
  queue: SIZE_M,
  cache: 140,
  'function': 140,
  container: 160,
  bucket: 140,
  document: 120,  // Increased min width
  documents: 120,
};

/** Min + max height per shape (from the visual-vocabulary sizing table).
 * max: preferred maximum for typical content
 * absoluteMax: hard limit for excessive content
 * Bands mirror AGENTS.md §"Node sizing" / nodeSizing.test.ts.
 */
const SHAPE_HEIGHT_RANGE: Record<ShapeFit, { min: number; max: number; absoluteMax: number }> = {
  rectangle: { min: 100, max: Infinity, absoluteMax: Infinity },
  'rounded-rectangle': { min: 100, max: Infinity, absoluteMax: Infinity },
  diamond: { min: 100, max: SHAPE_LANE_HEIGHT_CAP, absoluteMax: SHAPE_LANE_HEIGHT_CAP * 1.5 },
  parallelogram: { min: 100, max: Infinity, absoluteMax: Infinity },
  circle: { min: 100, max: SHAPE_LANE_HEIGHT_CAP, absoluteMax: SHAPE_LANE_HEIGHT_CAP * 1.5 },
  cylinder: { min: 100, max: Infinity, absoluteMax: Infinity },
  hexagon: { min: 100, max: 120, absoluteMax: 180 },
  cloud: { min: 100, max: 112, absoluteMax: 160 },
  actor: { min: 124, max: 148, absoluteMax: 176 },
  monitor: { min: 100, max: 120, absoluteMax: 180 },
  mobile: { min: 100, max: 130, absoluteMax: 180 },
  'dashed-rectangle': { min: 100, max: 112, absoluteMax: 168 },
  // New architecture-native shapes
  queue: { min: 100, max: 100, absoluteMax: 120 },
  cache: { min: 100, max: 104, absoluteMax: 156 },
  'function': { min: 100, max: 104, absoluteMax: 156 },
  container: { min: 100, max: 120, absoluteMax: 180 },
  bucket: { min: 100, max: 112, absoluteMax: 168 },
  document: { min: 156, max: 195, absoluteMax: 390 },  // Match documents
  documents: { min: 156, max: 195, absoluteMax: 390 },
};

export interface NodeDimensions {
  width: number;
  height: number;
}

export interface DimensionOptions {
  shape?: ShapeFit | string;
  /** Horizontal pipe (queue) vs vertical drum (database). */
  cylinderAxis?: 'vertical' | 'horizontal';
  /** Explicit floor (e.g. configured service default). */
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  /** When false, omit the icon-stack height reservation so the node shrinks. */
  showIcon?: boolean;
}

/** Fixed grid: widths snap to 160/200/240 (120/160 for XS). Beyond L only when caller explicitly opts-in via max > L. */
export function fitWidthToContent(width: number, min = SIZE_S, max = SIZE_L): number {
  const clamped = Math.min(Math.max(width, min), max);
  // Compact XS tier (actor/mobile): 120 or 160 only; respect caller's max
  if (min < SIZE_S) {
    const xsSnap = clamped <= 135 ? SIZE_XS : SIZE_S;
    return Math.min(max, Math.max(min, xsSnap));
  }
  // When caller allows beyond L (e.g., document 260, custom 320), step in 40px increments
  if (max > SIZE_L) {
    return Math.min(max, Math.max(min, Math.ceil(clamped / 40) * 40));
  }
  // Standard fixed grid: strict 160/200/240 — edges share same X per rank
  return clampToSizeGrid(clamped);
}

function normalizeShape(shape?: string): ShapeFit {
  switch (shape) {
    case 'diamond':
    case 'cylinder':
    case 'circle':
    case 'parallelogram':
    case 'rounded-rectangle':
      return shape;
    case 'rectangle':
      return 'rounded-rectangle';
    case 'hexagon':
    case 'cloud':
    case 'actor':
    case 'monitor':
    case 'mobile':
    case 'dashed-rectangle':
    // Architecture-native shapes
    case 'queue':
    case 'cache':
    case 'function':
    case 'container':
    case 'bucket':
    case 'document':
    case 'documents':
      return shape;
    default:
      return 'rounded-rectangle';
  }
}

/** Logical line count for horizontal pipe labels (title newlines + subtitle). */
export function countPipeLabelLines(label?: string, subtitle?: string): number {
  const lines = [
    ...String(label || 'Service').split(/\n/),
    ...(subtitle ? String(subtitle).split(/\n/) : []),
  ].filter(Boolean);
  return Math.max(1, lines.length);
}

/** Horizontal pipe bbox height — grows with stacked label lines and icon. Minimum 100px per audit. */
export function getHorizontalPipeHeight(lineCount: number, showIcon: boolean = false): number {
  const iconPadding = showIcon ? 36 : 0;  // Extra height for icon (ICON_SIZE.box + padding)
  if (lineCount <= 1) return 100 + iconPadding;
  if (lineCount === 2) return 110 + iconPadding;
  return 120 + iconPadding;
}

/**
 * Queue (horizontal pipe) bbox height — minimum 100px per audit.
 */
export function getQueuePipeHeight(lineCount: number): number {
  if (lineCount <= 1) return 100;
  if (lineCount === 2) return 110;
  return 120;
}

/**
 * Fixed-grid node sizing — guarantees edges share the same level per rank.
 * Widths snap strictly to 160/200/240 (120/160 for XS). Heights are fixed
 * per shape (100 for most, actor 124, document 156, etc.) and do NOT grow
 * with wrapped lines — labels wrap inside the fixed box. This keeps Dagre
 * rank centers aligned so all edges in the same rank sit on one Y.
 */
export function calculateNodeDimensions(
  label: string,
  subtitle?: string,
  options: DimensionOptions = {},
): NodeDimensions {
  const shape = normalizeShape(options.shape);
  const isQueue = shape === 'queue';
  const isHorizontalPipe = (shape === 'cylinder' && options.cylinderAxis === 'horizontal') || shape === 'queue';
  const band = SHAPE_TEXT_BAND[shape];
  const heightRange = SHAPE_HEIGHT_RANGE[shape];

  const minWidth = options.minWidth ?? ((isHorizontalPipe || isQueue) ? SIZE_L : SHAPE_MIN_WIDTH[shape]);
  const maxWidth = options.maxWidth ?? ((isHorizontalPipe || isQueue) ? SIZE_L : SHAPE_PREFERRED_MAX_WIDTH[shape]);

  // Width: longest line -> ideal bbox, then snap to fixed grid (no expansion beyond max)
  const lines = [
    ...String(label || 'Service').split(/\n/),
    ...(subtitle ? String(subtitle).split(/\n/) : []),
  ].filter(Boolean);
  const longestLineLength = Math.max(1, ...lines.map((line) => line.length));
  const idealBandWidth = longestLineLength * AVG_CHAR_WIDTH + 16;
  const idealBBoxWidth = idealBandWidth / band;
  const width = fitWidthToContent(idealBBoxWidth, minWidth, maxWidth);

  // Height: fixed per shape — no growth with wrappedLines. Dagre centers stay aligned.
  // Queue / horizontal pipes keep their 100/110/120 stepped height for pipe caps,
  // but width is still grid-locked; vertical cylinders and documents use their
  // fixed minima so ranks stay level.
  let height: number;
  if (isQueue) {
    // Queue: fixed 100 for single line, stepped only for explicit newlines (not wrapping)
    const lineCount = countPipeLabelLines(label, subtitle);
    height = getQueuePipeHeight(lineCount);
    // Force width to grid as well (was 240/280 before)
    // width already snapped above
  } else if (isHorizontalPipe) {
    height = getHorizontalPipeHeight(countPipeLabelLines(label, subtitle), options.showIcon === true);
  } else {
    height = heightRange.min;
    // Actor is intentionally taller (124) so its body can contain the title
    // Do not scale actor down to 100 — keep its fixed taller box
  }

  // Clamp queue width to standard grid (was XL 280) — keep 160/200/240
  // Already done via fitWidthToContent with SIZE_M/SIZE_L

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid };
