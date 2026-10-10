import type { ShapeType } from '@/lib/shapeRegistry';
import type { RenderStylePack, SketchRoughOptions } from './types';

/** Default rough.js options — balanced hand-drawn wobble (Excalidraw-like).
 *  Tuned for readable architecture diagrams: enough wobble to feel hand-drawn,
 *  but not so much that dense diagrams shimmer. Multi-stroke stays on for
 *  natural line weight variation; preserveVertices keeps orthogonal edges crisp
 *  at bends while wobbling the straights.
 */
export const SKETCH_ROUGH_OPTIONS: SketchRoughOptions = {
  roughness: 1.95,
  bowing: 1.15,
  strokeWidth: 1.55,
  fillStyle: 'solid',
  fillWeight: 0.42,
  hachureAngle: 42,
  hachureGap: 7.5,
  disableMultiStroke: false,
  preserveVertices: false,
};

/** Clean paper card fill for sketch on light mode — warm off-white, not beige.
 *  Lighter than before (#fdf6e3) so nodes feel like fresh paper, not aged.
 */
export const SKETCH_PAPER_TINT = '#fefcf3';

/** Cool dark paper fill for sketch on dark mode — neutral charcoal, not brown. */
export const SKETCH_PAPER_DARK = '#1e1f24';

/** Chalk border for dark sketch cards — visible on cool dark paper. */
export const SKETCH_PAPER_DARK_BORDER = 'rgba(253, 251, 240, 0.26)';

/** Warm hand-ink stroke — penciled line on dark paper. */
export const SKETCH_INK_WARM = 'rgba(254, 252, 243, 0.62)';

// ── Light-mode ink system — crisp hand-drawn on clean paper ─────────────────

/** Title ink — deep ink, softer than pure black for hand-drawn. */
export const SKETCH_INK_LIGHT_TITLE = '#1e1c1a';

/** Subtitle ink — warm stone, penciled secondary. */
export const SKETCH_INK_LIGHT_SUBTITLE = '#57534e';

/** Node border — graphite, visible but quiet wobble on clean paper. */
export const SKETCH_INK_LIGHT_BORDER = 'rgba(30, 28, 26, 0.32)';

/** Default edge ink — neutral graphite for connectors (softer than pure black). */
export const SKETCH_INK_LIGHT_EDGE = '#3f3c3a';

/** Group zone — neutral tinted swimlane on clean paper. */
export const SKETCH_GROUP_FILL_LIGHT = 'rgba(100, 95, 90, 0.05)';
export const SKETCH_GROUP_STROKE_LIGHT = 'rgba(68, 62, 58, 0.24)';

/** Canvas background — clean warm off-white paper (hsl for Tailwind). */
export const SKETCH_CANVAS_BG_LIGHT = '38 32% 97%';

/** Grid dots — soft warm taupe on clean paper. */
export const SKETCH_GRID_COLOR_LIGHT = '35 14% 88%';

// ── Dark-mode ink system — chalk on cool charcoal ──────────────────────────

/** Canvas background — cool charcoal, not brown. */
export const SKETCH_CANVAS_BG_DARK = '222 14% 9%';

/** Grid dots — cool muted on dark. */
export const SKETCH_GRID_COLOR_DARK = '222 10% 17%';

/** Title ink — warm cream chalk. */
export const SKETCH_INK_DARK_TITLE = '#fefcf3';

/** Subtitle ink — warm stone chalk, softer. */
export const SKETCH_INK_DARK_SUBTITLE = '#a8a29e';

/** Default edge ink — warm chalk. */
export const SKETCH_INK_DARK_EDGE = '#d6d3d1';

/** Group zone — cool translucent on dark. */
export const SKETCH_GROUP_FILL_DARK = 'rgba(254, 252, 243, 0.04)';
export const SKETCH_GROUP_STROKE_DARK = 'rgba(254, 252, 243, 0.18)';

// ── Edge inks — warm hand-ink palette for connectors ────────────────────────

/** Primary edge ink — deep ink / warm chalk (clear hierarchy, not neon). */
export const SKETCH_EDGE_PRIMARY_LIGHT = '#1e1c1a';
export const SKETCH_EDGE_PRIMARY_DARK = '#fefcf3';

/** Async edge ink — muted terracotta / soft amber chalk. */
export const SKETCH_EDGE_ASYNC_LIGHT = '#9a3412';
export const SKETCH_EDGE_ASYNC_DARK = '#fbbf24';

/** Stream/event inks — hand-ink teal / amber. */
export const SKETCH_STREAM_INK = '#0f766e';
export const SKETCH_EVENT_INK = '#1d4ed8';

/** Cross-hatch ink — quiet graphite / chalk on paper (lower opacity, less noisy). */
export const SKETCH_HATCH_INK_LIGHT = 'rgba(30, 28, 26, 0.10)';
export const SKETCH_HATCH_INK_DARK = 'rgba(254, 252, 243, 0.11)';

export function sketchHatchInk(isDark: boolean): string {
  return isDark ? SKETCH_HATCH_INK_DARK : SKETCH_HATCH_INK_LIGHT;
}

/** Full edge ink palette for sketch mode — mirrors what resolveCanvasTokens
 *  exposes as `colors.edgePrimary / edgeDefault / edgeAsync` plus the muted
 *  stream/event/dep tones. `SKETCH_INK_WARM` carries the dark supporting
 *  (control-plane) fallback so the token is exercised, not dead. */
export interface SketchEdgeInk {
  primary: string;
  /** Secondary sync edges. */
  default: string;
  /** Control-plane / supporting / observability edges — quieter still. */
  supporting: string;
  /** Dependency edges. */
  dep: string;
  async: string;
  stream: string;
  event: string;
}

export function sketchEdgeInk(isDark: boolean): SketchEdgeInk {
  return isDark
    ? {
        primary: SKETCH_EDGE_PRIMARY_DARK,
        default: SKETCH_INK_DARK_EDGE,
        supporting: SKETCH_INK_DARK_EDGE,  // Unified with default for less variety
        dep: SKETCH_INK_DARK_EDGE,
        async: SKETCH_EDGE_ASYNC_DARK,
        stream: SKETCH_STREAM_INK,
        event: SKETCH_EVENT_INK,
      }
    : {
        primary: SKETCH_EDGE_PRIMARY_LIGHT,
        default: SKETCH_INK_LIGHT_EDGE,
        supporting: SKETCH_INK_LIGHT_EDGE,  // Unified with default for less variety
        dep: SKETCH_INK_LIGHT_EDGE,
        async: SKETCH_EDGE_ASYNC_LIGHT,
        stream: SKETCH_STREAM_INK,
        event: SKETCH_EVENT_INK,
      };
}

/** Sketch fill per silhouette — clean paper with wobbly ink.
 *  Most shapes are `solid` (warm paper fill + hand-drawn outline) so dense
 *  diagrams don't shimmer with texture. Only group zones get light `hachure`
 *  to read as penciled swimlanes. Cross-hatch is reserved for explicit
 *  callers (e.g. selected accent) — not a default body fill.
 */
export function sketchFillForShape(shape?: ShapeType | string | null): SketchRoughOptions['fillStyle'] {
  if (!shape) return 'solid';
  const s = String(shape).toLowerCase();
  // Group container — light hachure swimlane (the only default textured fill)
  if (s === 'group' || s === 'groupnode' || s === 'frame') return 'hachure';
  // All node bodies: solid paper + wobbly outline. Keep small glyphs +
  // cylinders solid as well so icons stay crisp.
  return 'solid';
}

/**
 * Sketch render style — clean hand-drawn: warm paper, wobbly rough.js
 * strokes, quiet fills, handwritten typography (selectively).
 */
export const SKETCH_RENDER_STYLE: RenderStylePack = {
  id: 'sketch',
  label: 'Sketch',
  description: 'Hand-drawn — clean paper, wobbly ink, soft fills, hand-lettered labels.',
  strokeEngine: 'rough',
  roughOptions: SKETCH_ROUGH_OPTIONS,

  fonts: {
    title: '"Patrick Hand", "Nanum Pen Script", cursive',
    subtitle: '"Caveat", "Patrick Hand", cursive',
    edgeLabel: '"Patrick Hand", cursive',
    annotation: '"Caveat", cursive',
    googleFontFamily: 'Patrick+Hand&family=Caveat:wght@500;700',
  },

  geometry: {
    borderRadiusScale: 1.14,
    strokeWidthScale: 1.18,
    labelPaddingX: 4,
    labelPaddingY: 3,
    sizeGridNudge: 0,
    dropShadow: 'none',
  },

  edges: {
    pathStyle: 'orthogonal-sketch',
    arrowheadStyle: 'hand-drawn',
    labelBackground: 'sketch-box',
    animatedAsync: false,
  },

  groups: {
    borderStyle: 'rough-dashed',
    labelStyle: 'handwritten',
    fillOpacity: 0.95,
  },

  icons: {
    mode: 'sharp-muted',
    mutedOpacity: 0.9,
  },
};
