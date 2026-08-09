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
const PADDING_Y = 36;
const MIN_HEIGHT = 80;
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
  | 'shield'
  | 'actor'
  | 'monitor'
  | 'mobile'
  | 'dashed-rectangle';

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
  hexagon: 0.52,
  cloud: 0.8,
  shield: 0.6,
  actor: 0.56,
  monitor: 0.72,
  mobile: 0.56,
  'dashed-rectangle': 0.88,
};

/** Mild height padding for non-rect silhouettes (not a large multiplier). */
const SHAPE_HEIGHT_FACTOR: Record<ShapeFit, number> = {
  rectangle: 1,
  'rounded-rectangle': 1,
  diamond: 1.12,
  parallelogram: 1.05,
  circle: 1.1,
  cylinder: 1.08,
  hexagon: 1.12,
  cloud: 1.12,
  shield: 1.18,
  actor: 1.1,
  monitor: 1.1,
  mobile: 1.1,
  'dashed-rectangle': 1,
};

/** Legacy compact icon stack for diamonds (excluded from enlarged icons). */
const DIAMOND_ICON_STACK = ICON_SIZE.diamond.box + 8;

/** Default max width: diamonds/circles stay on the optical grid. */
const SHAPE_MAX_WIDTH: Record<ShapeFit, number> = {
  rectangle: SIZE_L,
  'rounded-rectangle': SIZE_L,
  diamond: SIZE_L,
  parallelogram: SIZE_L,
  circle: SIZE_L,
  cylinder: SIZE_L,
  hexagon: SIZE_M,
  cloud: SIZE_L,
  shield: SIZE_M,
  actor: SIZE_S,
  monitor: SIZE_L,
  mobile: SIZE_S,
  'dashed-rectangle': SIZE_L,
};

/** Min width per shape — actors/phones stay compact, clouds/monitors wider. */
const SHAPE_MIN_WIDTH: Record<ShapeFit, number> = {
  rectangle: SIZE_M,
  'rounded-rectangle': SIZE_M,
  diamond: SIZE_S,
  parallelogram: SIZE_M,
  circle: SIZE_S,
  cylinder: SIZE_M,
  hexagon: SIZE_S,
  cloud: SIZE_M,
  shield: SIZE_S,
  actor: SIZE_XS,
  monitor: SIZE_M,
  mobile: SIZE_XS,
  'dashed-rectangle': SIZE_S,
};

/** Min + max height per shape (from the visual-vocabulary sizing table). */
const SHAPE_HEIGHT_RANGE: Record<ShapeFit, { min: number; max: number }> = {
  rectangle: { min: MIN_HEIGHT, max: Infinity },
  'rounded-rectangle': { min: MIN_HEIGHT, max: Infinity },
  diamond: { min: 80, max: SHAPE_LANE_HEIGHT_CAP },
  parallelogram: { min: MIN_HEIGHT, max: Infinity },
  circle: { min: 80, max: SHAPE_LANE_HEIGHT_CAP },
  cylinder: { min: 100, max: Infinity },
  hexagon: { min: 88, max: SHAPE_LANE_HEIGHT_CAP },
  cloud: { min: 96, max: 112 },
  shield: { min: 96, max: 112 },
  actor: { min: 88, max: 100 },
  monitor: { min: 100, max: 120 },
  mobile: { min: 100, max: 130 },
  'dashed-rectangle': { min: 88, max: 112 },
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
}

/** Snap to the optical grid; optionally step in 40px increments when max > L. */
export function fitWidthToContent(width: number, min = SIZE_S, max = SIZE_L): number {
  const clamped = Math.min(Math.max(width, min), max);
  // Compact shapes (min below the S grid) snap to 40px steps (120/160/…).
  if (min < SIZE_S) {
    return Math.min(max, Math.max(min, Math.round(clamped / 40) * 40));
  }
  if (clamped <= SIZE_L + 20) return Math.min(max, clampToSizeGrid(clamped));
  return Math.min(max, Math.ceil(clamped / 40) * 40);
}

function normalizeShape(shape?: string): ShapeFit {
  switch (shape) {
    case 'diamond':
    case 'cylinder':
    case 'circle':
    case 'parallelogram':
    case 'rounded-rectangle':
    case 'hexagon':
    case 'cloud':
    case 'shield':
    case 'actor':
    case 'monitor':
    case 'mobile':
    case 'dashed-rectangle':
      return shape;
    default:
      return 'rectangle';
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

/** Horizontal pipe bbox height — grows with stacked label lines. */
export function getHorizontalPipeHeight(lineCount: number): number {
  if (lineCount <= 1) return 40;
  if (lineCount === 2) return 52;
  return 58;
}

/**
 * Compute node width/height from label length.
 * Long text wraps inside the grid instead of inflating past SIZE_L.
 */
export function calculateNodeDimensions(
  label: string,
  subtitle?: string,
  options: DimensionOptions = {},
): NodeDimensions {
  const shape = normalizeShape(options.shape);
  const isHorizontalPipe = shape === 'cylinder' && options.cylinderAxis === 'horizontal';
  const band = SHAPE_TEXT_BAND[shape];
  const heightFactor = SHAPE_HEIGHT_FACTOR[shape];
  const heightRange = SHAPE_HEIGHT_RANGE[shape];
  const minWidth = options.minWidth ?? (
    isHorizontalPipe ? SIZE_L : SHAPE_MIN_WIDTH[shape]
  );
  const minHeight = options.minHeight ?? (isHorizontalPipe ? 40 : heightRange.min);
  const maxWidth = options.maxWidth ?? (isHorizontalPipe ? SIZE_L : SHAPE_MAX_WIDTH[shape]);
  const iconStack = shape === 'diamond' ? DIAMOND_ICON_STACK : (isHorizontalPipe ? 0 : ICON_STACK);

  const lines = [
    ...String(label || 'Service').split(/\n/),
    ...(subtitle ? String(subtitle).split(/\n/) : []),
  ].filter(Boolean);

  const longestLineLength = Math.max(1, ...lines.map((line) => line.length));
  // Width needed so the longest line fits in the usable text band (single line).
  const idealBandWidth = longestLineLength * AVG_CHAR_WIDTH + 16;
  const idealBBoxWidth = idealBandWidth / band;

  // Prefer the optical grid; wrap when the ideal bbox would exceed max.
  let width = fitWidthToContent(idealBBoxWidth, minWidth, maxWidth);
  const usableWidth = Math.max(64, width * band);

  let wrappedLines = 0;
  for (const line of lines) {
    const lineW = line.length * AVG_CHAR_WIDTH;
    wrappedLines += Math.max(1, Math.ceil(lineW / usableWidth));
  }

  let height =
    Math.max(minHeight, wrappedLines * LINE_HEIGHT + PADDING_Y + iconStack) * heightFactor;

  // Keep diamonds / circles roughly balanced so labels stay in the mid-band.
  if (shape === 'diamond' || shape === 'circle') {
    height = Math.max(height, Math.round(width * 0.52));
  }

  // Enforce per-shape height ranges (visual-vocabulary sizing table).
  height = Math.min(Math.max(height, heightRange.min), heightRange.max);

  if (isHorizontalPipe) {
    const capPad = 48;
    const textWidth = longestLineLength * AVG_CHAR_WIDTH + capPad;
    width = Math.max(SIZE_L, Math.min(SIZE_XL, Math.ceil(textWidth / 40) * 40));
    height = getHorizontalPipeHeight(countPipeLabelLines(label, subtitle));
  }

  if (shape === 'cylinder' && !isHorizontalPipe) {
    width = Math.max(width, SIZE_M);
    height = Math.max(height, 100);
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid };
