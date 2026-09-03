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
 * Compute node width/height from label length.
 * Nodes can grow beyond preferred max if content requires it, up to absolute max.
 * Dynamic sizing allows all nodes to accommodate more content gracefully.
 */
export function calculateNodeDimensions(
  label: string,
  subtitle?: string,
  options: DimensionOptions = {},
): NodeDimensions {
  const shape = normalizeShape(options.shape);
  
  // Queue shape uses horizontal pipe layout
  const isQueue = shape === 'queue';
  
  // Legacy: cylinder can still be horizontal for old diagrams
  const isHorizontalPipe = (shape === 'cylinder' && options.cylinderAxis === 'horizontal') || shape === 'queue';
  
  const band = SHAPE_TEXT_BAND[shape];
  const heightFactor = SHAPE_HEIGHT_FACTOR[shape];
  const heightRange = SHAPE_HEIGHT_RANGE[shape];
  
  const minWidth = options.minWidth ?? (
    (isHorizontalPipe || isQueue) ? SIZE_L : SHAPE_MIN_WIDTH[shape]
  );
  const minHeight = options.minHeight ?? ((isHorizontalPipe || isQueue) ? 100 : heightRange.min);
  const preferredMaxWidth = options.maxWidth ?? ((isHorizontalPipe || isQueue) ? SIZE_L : SHAPE_PREFERRED_MAX_WIDTH[shape]);
  const absoluteMaxWidth = SHAPE_ABSOLUTE_MAX_WIDTH[shape];
  const iconStack = shape === 'diamond' ? DIAMOND_ICON_STACK : ((isHorizontalPipe || isQueue) ? 0 : ICON_STACK);
  const effectiveIconStack = options.showIcon === false ? 0 : iconStack;

  const lines = [
    ...String(label || 'Service').split(/\n/),
    ...(subtitle ? String(subtitle).split(/\n/) : []),
  ].filter(Boolean);

  const longestLineLength = Math.max(1, ...lines.map((line) => line.length));
  // Width needed so the longest line fits in the usable text band (single line).
  const idealBandWidth = longestLineLength * AVG_CHAR_WIDTH + 16;
  const idealBBoxWidth = idealBandWidth / band;

  // Try to fit content within preferred max first
  let width = fitWidthToContent(idealBBoxWidth, minWidth, preferredMaxWidth);
  let usableWidth = Math.max(64, width * band);
  
  // Calculate wrapped lines with current width
  let wrappedLines = 0;
  for (const line of lines) {
    const lineW = line.length * AVG_CHAR_WIDTH;
    wrappedLines += Math.max(1, Math.ceil(lineW / usableWidth));
  }
  
  // If content wraps too much (more than 8 lines after wrapping), expand width up to absolute max
  if (wrappedLines > 8 && width < absoluteMaxWidth) {
    const expandedWidth = Math.min(idealBBoxWidth, absoluteMaxWidth);
    if (expandedWidth > width) {
      width = fitWidthToContent(expandedWidth, width, absoluteMaxWidth);
      usableWidth = Math.max(64, width * band);
      
      // Recalculate wrapped lines with expanded width
      wrappedLines = 0;
      for (const line of lines) {
        const lineW = line.length * AVG_CHAR_WIDTH;
        wrappedLines += Math.max(1, Math.ceil(lineW / usableWidth));
      }
    }
  }

  let height =
    Math.max(minHeight, wrappedLines * LINE_HEIGHT + PADDING_Y + effectiveIconStack) * heightFactor;

  // Keep diamonds / circles roughly balanced so labels stay in the mid-band.
  if (shape === 'diamond' || shape === 'circle') {
    height = Math.max(height, Math.round(width * 0.52));
  }

  // Use preferred max first, but allow growth to absoluteMax if content needs it.
  // Diamond/circle/hexagon switch to the absolute max earlier: their lane cap
  // clips multi-line labels — allow growth when text wraps.
  const isMidBandShape = shape === 'diamond' || shape === 'circle' || shape === 'hexagon';
  let effectiveMaxHeight = heightRange.max;
  if (wrappedLines > 6 || (isMidBandShape && wrappedLines > 2)) {
    effectiveMaxHeight = heightRange.absoluteMax;
  }
  
  // Enforce per-shape height ranges with dynamic maximum
  height = Math.min(Math.max(height, heightRange.min), effectiveMaxHeight);

  // Queue shape (horizontal pipe) has special sizing.
  // Pipe-text layout never renders icons (ShapeNode forces showIcon=false for
  // pipes), so only an explicit `showIcon: true` reserves icon padding —
  // defaulting to true made layout reserve 36px the render never uses.
  if (isQueue) {
    const capPad = 48;
    const textWidth = longestLineLength * AVG_CHAR_WIDTH + capPad;
    width = Math.max(SIZE_L, Math.min(SIZE_XL, Math.ceil(textWidth / 40) * 40));
    // For queue, also consider wrapping due to width (not just newline)
    const queueUsable = Math.max(64, width * SHAPE_TEXT_BAND.queue);
    let queueWrapped = 0;
    for (const line of lines) {
      const lineW = line.length * AVG_CHAR_WIDTH;
      queueWrapped += Math.max(1, Math.ceil(lineW / queueUsable));
    }
    const lineCount = Math.max(countPipeLabelLines(label, subtitle), queueWrapped);
    height = getQueuePipeHeight(lineCount);
  } else if (isHorizontalPipe) {
    // Legacy: horizontal pipe cylinder
    const capPad = 48;
    const textWidth = longestLineLength * AVG_CHAR_WIDTH + capPad;
    width = Math.max(SIZE_L, Math.min(SIZE_XL, Math.ceil(textWidth / 40) * 40));
    height = getHorizontalPipeHeight(countPipeLabelLines(label, subtitle), options.showIcon === true);
  }

  // Cylinder (vertical drum) needs minimum dimensions
  if (shape === 'cylinder' && !isHorizontalPipe) {
    width = Math.max(width, options.minWidth ?? 160);
    height = Math.max(height, options.minHeight ?? 100);
  }

  // Strict audit: default height for every node type is exactly 100px
  // Single-line labels (including fallback 'Service') must render at 100,
  // not 107/112/120/195. Multi-line labels may grow beyond 100.
  // Actor is taller by design so the body can contain the title with
  // expanded bottom padding (user request: "expand the bottom space").
  if (wrappedLines === 1) {
    height = shape === 'actor' ? heightRange.min : 100;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export { SIZE_S, SIZE_M, SIZE_L, clampToSizeGrid };
