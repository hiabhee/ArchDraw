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
  actor: 0.42,
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
  actor: SIZE_M,
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
  actor: SIZE_L,  // Allow wider for big words like CUSTOMER/DRIVER
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

/** Uniform height: all nodes are 100px per user request — no per-shape variation. */
const SHAPE_HEIGHT_RANGE: Record<ShapeFit, { min: number; max: number; absoluteMax: number }> = {
  rectangle: { min: 100, max: 100, absoluteMax: 100 },
  'rounded-rectangle': { min: 100, max: 100, absoluteMax: 100 },
  diamond: { min: 100, max: 100, absoluteMax: 100 },
  parallelogram: { min: 100, max: 100, absoluteMax: 100 },
  circle: { min: 100, max: 100, absoluteMax: 100 },
  cylinder: { min: 100, max: 100, absoluteMax: 100 },
  hexagon: { min: 100, max: 100, absoluteMax: 100 },
  cloud: { min: 100, max: 100, absoluteMax: 100 },
  actor: { min: 100, max: 100, absoluteMax: 100 },
  monitor: { min: 100, max: 100, absoluteMax: 100 },
  mobile: { min: 100, max: 100, absoluteMax: 100 },
  'dashed-rectangle': { min: 100, max: 100, absoluteMax: 100 },
  queue: { min: 100, max: 100, absoluteMax: 100 },
  cache: { min: 100, max: 100, absoluteMax: 100 },
  'function': { min: 100, max: 100, absoluteMax: 100 },
  container: { min: 100, max: 100, absoluteMax: 100 },
  bucket: { min: 100, max: 100, absoluteMax: 100 },
  document: { min: 100, max: 100, absoluteMax: 100 },
  documents: { min: 100, max: 100, absoluteMax: 100 },
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

/** Uniform height 100 per user request — pipe variants also fixed. */
export function getHorizontalPipeHeight(_lineCount?: number, _showIcon?: boolean): number {
  return 100;
}

/** Uniform height 100 per user request. */
export function getQueuePipeHeight(_lineCount?: number): number {
  return 100;
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

  // Uniform 100px for all nodes per user request — no per-shape variation, no growth with lines.
  const height = 100;

  // Clamp queue width to standard grid (was XL 280) — keep 160/200/240
  // Already done via fitWidthToContent with SIZE_M/SIZE_L

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid };
