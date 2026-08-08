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
  | 'parallelogram';

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
};

/** Mild height padding for non-rect silhouettes (not a large multiplier). */
const SHAPE_HEIGHT_FACTOR: Record<ShapeFit, number> = {
  rectangle: 1,
  'rounded-rectangle': 1,
  diamond: 1.12,
  parallelogram: 1.05,
  circle: 1.1,
  cylinder: 1.08,
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
};

export interface NodeDimensions {
  width: number;
  height: number;
}

export interface DimensionOptions {
  shape?: ShapeFit | string;
  /** Explicit floor (e.g. configured service default). */
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
}

/** Snap to the optical grid; optionally step in 40px increments when max > L. */
export function fitWidthToContent(width: number, min = SIZE_S, max = SIZE_L): number {
  const clamped = Math.min(Math.max(width, min), max);
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
      return shape;
    default:
      return 'rectangle';
  }
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
  const band = SHAPE_TEXT_BAND[shape];
  const heightFactor = SHAPE_HEIGHT_FACTOR[shape];
  const minWidth = options.minWidth ?? (shape === 'diamond' || shape === 'circle' ? SIZE_S : SIZE_M);
  const minHeight = options.minHeight ?? MIN_HEIGHT;
  const maxWidth = options.maxWidth ?? SHAPE_MAX_WIDTH[shape];
  const iconStack = shape === 'diamond' ? DIAMOND_ICON_STACK : ICON_STACK;

  const lines = [
    ...String(label || 'Service').split(/\n/),
    ...(subtitle ? String(subtitle).split(/\n/) : []),
  ].filter(Boolean);

  const longestLineLength = Math.max(1, ...lines.map((line) => line.length));
  // Width needed so the longest line fits in the usable text band (single line).
  const idealBandWidth = longestLineLength * AVG_CHAR_WIDTH + 16;
  const idealBBoxWidth = idealBandWidth / band;

  // Prefer the optical grid; wrap when the ideal bbox would exceed max.
  const width = fitWidthToContent(idealBBoxWidth, minWidth, maxWidth);
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
    height = Math.min(height, SHAPE_LANE_HEIGHT_CAP);
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid };
