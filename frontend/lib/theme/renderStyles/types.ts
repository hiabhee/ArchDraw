/**
 * Render-style types — Layer 1 of the aesthetic-themes architecture.
 * See `docs/diagram-aesthetic-themes-plan.md`.
 */

/** Render / aesthetic style id — how shapes are drawn (not color, not chrome). */
export type DiagramRenderStyleId = 'precision' | 'sketch' | 'neubrutalism';

/** Which stroke engine draws primitives. */
export type StrokeEngineId = 'crisp' | 'rough' | 'brutalist';

/**
 * Normalized shape geometry in local node coordinates (0,0) → (width, height).
 * Style-agnostic — produced by `shapeGeometry/getShapePrimitives`.
 */
export interface ShapePrimitive {
  kind: 'rect' | 'rounded-rect' | 'ellipse' | 'polygon' | 'path' | 'line' | 'polyline';
  bounds: { x: number; y: number; width: number; height: number };
  /** Absolute coordinate string ("x,y x,y …") for polygon / polyline. */
  points?: string;
  /** Path data string for path primitives. */
  d?: string;
  /** Line endpoints for line primitives. */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** Corner radius for rect / rounded-rect. */
  rx?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dasharray?: string;
  opacity?: number;
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
  strokeLinecap?: 'round' | 'butt' | 'square';
  /** Body primitives receive the surface fill. */
  fillable?: boolean;
  /** Stroke-only details (rims, head glyphs) — fill forced to none. */
  strokeOnly?: boolean;
  /** Fill with the surface stroke color (notches, stand bars). */
  fillAsStroke?: boolean;
  /** Per-primitive rough fill style override (defaults to renderer's option). */
  fillStyle?: SketchRoughOptions['fillStyle'];
}

/** Edge stroke options passed to `strokeRenderer.renderEdgePath`. */
export interface EdgeStrokeOpts {
  d: string;
  stroke: string;
  strokeWidth: number;
  dasharray?: string;
  opacity?: number;
}

export interface Point {
  x: number;
  y: number;
}

/** rough.js options — only when strokeEngine === 'rough'. */
export interface SketchRoughOptions {
  roughness: number;
  bowing: number;
  strokeWidth: number;
  fillStyle: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch';
  fillWeight?: number;
  hachureAngle?: number;
  hachureGap?: number;
  disableMultiStroke?: boolean;
  preserveVertices?: boolean;
}

/** Per-aesthetic-style pack — what differs between `precision` and `sketch`. */
export interface RenderStylePack {
  id: DiagramRenderStyleId;
  label: string;
  description: string;

  /** Which stroke engine draws primitives. */
  strokeEngine: StrokeEngineId;

  /** rough.js options — only when strokeEngine === 'rough'. */
  roughOptions?: {
    roughness: number;
    bowing: number;
    strokeWidth: number;
    fillStyle: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch';
    fillWeight?: number;
    hachureAngle?: number;
    hachureGap?: number;
    disableMultiStroke?: boolean;
    preserveVertices?: boolean;
  };

  /** Typography overrides (canvas labels only). */
  fonts: {
    title: string;
    subtitle: string;
    edgeLabel: string;
    annotation: string;
    /** Google Fonts URL slug or local @font-face family. */
    googleFontFamily?: string;
  };

  /** Geometry feel — applied on top of the optical grid. */
  geometry: {
    /** precision: 1, sketch: 1.15 (softer corners). */
    borderRadiusScale: number;
    /** precision: 1, sketch: 1.2. */
    strokeWidthScale: number;
    /** Extra px inside shapes for wobble clearance. */
    labelPaddingX: number;
    labelPaddingY: number;
    /** sketch: +0 or +8px width snap bias. */
    sizeGridNudge: number;
    /** sketch: none or very subtle; neubrutalism: hard offset solid. */
    dropShadow: 'none' | 'soft' | 'sketch' | 'hard';
  };

  /** Edge-specific. */
  edges: {
    /** Same routing, different stroke. */
    pathStyle: 'orthogonal' | 'orthogonal-sketch' | 'orthogonal-brutal';
    arrowheadStyle: 'triangle' | 'hand-drawn' | 'filled-brutal';
    labelBackground: 'pill' | 'none' | 'sketch-box' | 'brutal-pill';
    /** sketch: false (dashed wobble + animation looks noisy). */
    animatedAsync: boolean;
  };

  /** Group / subgraph chrome. */
  groups: {
    borderStyle: 'solid' | 'rough-solid' | 'rough-dashed' | 'brutal-solid';
    labelStyle: 'tag' | 'handwritten' | 'brutalist';
    fillOpacity: number;
  };

  /** Icon treatment inside nodes. */
  icons: {
    /** Brand logos stay sharp in v1; optional light opacity reduction in sketch. */
    mode: 'sharp' | 'sharp-muted';
    mutedOpacity?: number;
  };
}

/** Fully resolved canvas tokens (render style × color theme × light/dark). */
export interface ResolvedCanvasTokens {
  render: RenderStylePack;
  renderStyleId: DiagramRenderStyleId;
  colorThemeId: string;
  isDark: boolean;
  strokeRenderer: import('./strokeRenderer').StrokeRenderer;
  colors: {
    nodeFill: string;
    nodeStroke: string;
    title: string;
    subtitle: string;
    groupFill: string;
    groupStroke: string;
    edgeDefault: string;
    edgePrimary: string;
    edgeAsync: string;
    shadow: string;
  };
  concerns: Record<'client' | 'compute' | 'data' | 'async' | 'external', import('@/lib/theme/stylingConstants').ConcernSwatch>;
  strokeWidth: number;
  borderRadius: number;
  fonts: RenderStylePack['fonts'];
  cssVars: Record<string, string>;
}
