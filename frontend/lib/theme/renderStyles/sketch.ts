import type { ShapeType } from '@/lib/shapeRegistry';
import type { RenderStylePack, SketchRoughOptions } from './types';

/** Default rough.js options — visible hand-drawn wobble. */
export const SKETCH_ROUGH_OPTIONS: SketchRoughOptions = {
  roughness: 1.22,
  bowing: 0.72,
  strokeWidth: 1.55,
  fillStyle: 'solid',
  fillWeight: 0.18,
  hachureAngle: 60,
  hachureGap: 12,
  disableMultiStroke: false,
  preserveVertices: false,
};

/** Clean paper card fill for sketch on light mode — matches precision white. */
export const SKETCH_PAPER_TINT = '#ffffff';

/** Neutral dark paper fill for sketch on dark mode — matches precision dark. */
export const SKETCH_PAPER_DARK = '#1a1d27';

/** Soft chalk border for dark sketch cards — matches precision dark stroke. */
export const SKETCH_PAPER_DARK_BORDER = 'rgba(255, 255, 255, 0.18)';

/** Warm off-white hand-ink stroke — unused but kept for API compat. */
export const SKETCH_INK_WARM = 'rgba(255, 255, 255, 0.55)';

// ── Light-mode ink system (matching precision slate tones) ─────────────────

/** Title ink — matches precision #0f172a. */
export const SKETCH_INK_LIGHT_TITLE = '#0f172a';

/** Subtitle ink — matches precision #94a3b8. */
export const SKETCH_INK_LIGHT_SUBTITLE = '#94a3b8';

/** Node border — matches precision rgba(15,23,42,0.2). */
export const SKETCH_INK_LIGHT_BORDER = 'rgba(15, 23, 42, 0.2)';

/** Default edge ink — matches precision #64748b. */
export const SKETCH_INK_LIGHT_EDGE = '#64748b';

/** Group zone — matches precision rgba(15,23,42,0.02). */
export const SKETCH_GROUP_FILL_LIGHT = 'rgba(15, 23, 42, 0.02)';
export const SKETCH_GROUP_STROKE_LIGHT = 'rgba(15, 23, 42, 0.16)';

/** Canvas background — matches precision default light. */
export const SKETCH_CANVAS_BG_LIGHT = '210 20% 98%';

/** Grid dots — matches precision default light. */
export const SKETCH_GRID_COLOR_LIGHT = '210 9% 87%';

// ── Dark-mode ink system (matching precision slate tones) ──────────────────

/** Canvas background — matches precision default dark. */
export const SKETCH_CANVAS_BG_DARK = '222 22% 10%';

/** Grid dots — matches precision default dark. */
export const SKETCH_GRID_COLOR_DARK = '217 18% 18%';

/** Title ink — matches precision #f1f5f9. */
export const SKETCH_INK_DARK_TITLE = '#f1f5f9';

/** Subtitle ink — matches precision #94a3b8. */
export const SKETCH_INK_DARK_SUBTITLE = '#94a3b8';

/** Default edge ink — matches precision #94a3b8. */
export const SKETCH_INK_DARK_EDGE = '#94a3b8';

/** Group zone — matches precision rgba(255,255,255,0.03). */
export const SKETCH_GROUP_FILL_DARK = 'rgba(255, 255, 255, 0.03)';
export const SKETCH_GROUP_STROKE_DARK = 'rgba(255, 255, 255, 0.16)';

// ── Edge inks (matching precision palette) ────────────────────────────────

/** Primary edge ink — matches precision #000000 light / #ffffff dark. */
export const SKETCH_EDGE_PRIMARY_LIGHT = '#000000';
export const SKETCH_EDGE_PRIMARY_DARK = '#ffffff';

/** Async edge ink — matches precision #b45309 light / #d97706 dark. */
export const SKETCH_EDGE_ASYNC_LIGHT = '#b45309';
export const SKETCH_EDGE_ASYNC_DARK = '#d97706';

/** Stream/event inks — matching precision blue for events. */
export const SKETCH_STREAM_INK = '#10b981';
export const SKETCH_EVENT_INK = '#1E90FF';

/** Cross-hatch ink — transparent since fillStyle is now solid. */
export const SKETCH_HATCH_INK_LIGHT = 'rgba(15, 23, 42, 0.095)';
export const SKETCH_HATCH_INK_DARK = 'rgba(255, 255, 255, 0.095)';

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

/** Sketch fill for node bodies — solid fill matching precision mode. */
export function sketchFillForShape(_shape?: ShapeType | string | null): SketchRoughOptions['fillStyle'] {
  return 'solid';
}

/**
 * Sketch render style — hand-drawn wobble on shapes and edges,
 * but precision colors and typography throughout.
 */
export const SKETCH_RENDER_STYLE: RenderStylePack = {
  id: 'sketch',
  label: 'Sketch',
  description: 'Hand-drawn feel with precision colors — wobbly strokes, clean palette.',
  strokeEngine: 'rough',
  roughOptions: SKETCH_ROUGH_OPTIONS,

  fonts: {
    title: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    subtitle: 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    edgeLabel: 'Inter, system-ui, -apple-system, sans-serif',
    annotation: 'Inter, system-ui, -apple-system, sans-serif',
  },

  geometry: {
    borderRadiusScale: 1,
    strokeWidthScale: 1,
    labelPaddingX: 0,
    labelPaddingY: 0,
    sizeGridNudge: 0,
    dropShadow: 'soft',
  },

  edges: {
    pathStyle: 'orthogonal-sketch',
    arrowheadStyle: 'hand-drawn',
    labelBackground: 'pill',
    animatedAsync: false,
  },

  groups: {
    borderStyle: 'rough-dashed',
    labelStyle: 'tag',
    fillOpacity: 1,
  },

  icons: {
    mode: 'sharp',
  },
};
