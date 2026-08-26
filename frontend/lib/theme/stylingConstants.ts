/**
 * Architecture visual system — single source of truth for canvas + SVG export.
 *
 * Grammar: thin strokes, soft/no depth, muted neutrals, 5 semantic accents,
 * optical size grid (160 / 200 / 240). Themes remapped stroke/fill/type/edges.
 * Primary flow uses brand DodgerBlue so the eye can track request paths.
 */

// ── Size grid ───────────────────────────────────────────────────────────────

export const SIZE_S = 160;
export const SIZE_M = 200;
export const SIZE_L = 240;

export const NODE_WIDTH = SIZE_M;
export const NODE_HEIGHT = 100;
/** Max layout height for diamond/circle so ELK lanes stay aligned with rects. */
export const SHAPE_LANE_HEIGHT_CAP = 100;
export const BORDER_RADIUS = 10;
export const STROKE_WIDTH = 1.25;
export const STROKE_EMPHASIS = 2;

/** Brand flow accent — primary edges, hover, selection rings. */
export const FLOW_ACCENT = '#1E90FF';
export const FLOW_ACCENT_SOFT = 'rgba(30, 144, 255, 0.12)';
export const FLOW_ACCENT_MUTED = '#4dabf7';

export const SIZE_GRID = {
  S: SIZE_S,
  M: SIZE_M,
  L: SIZE_L,
  max: SIZE_L,
} as const;

/** Clamp any computed width onto the optical grid. */
export function clampToSizeGrid(width: number): number {
  if (width <= SIZE_S + 20) return SIZE_S;
  if (width <= SIZE_M + 20) return SIZE_M;
  return SIZE_L;
}

/** Uniform icon slot for brand / prominent icons inside cylinders and rounded rects. */
export const PROMINENT_ICON_SLOT_PX = 48;
/** Glyph fills ~88% of slot so logos with different SVG padding look equal. */
export const PROMINENT_ICON_GLYPH_RATIO = 0.88;

export function prominentIconGlyphSize(): number {
  return Math.round(PROMINENT_ICON_SLOT_PX * PROMINENT_ICON_GLYPH_RATIO);
}

// ── Semantic concerns (color = meaning) ─────────────────────────────────────

export type Concern =
  | 'client'
  | 'compute'
  | 'data'
  | 'async'
  | 'external';

export interface ConcernSwatch {
  color: string;
  bg: string;
  label: string;
}

/** Default muted semantic accents — readable on icons/rails, quiet on fills. */
export const CONCERN_COLORS: Record<Concern, ConcernSwatch> = {
  client:   { color: '#475569', bg: 'rgba(71, 85, 105, 0.07)',  label: 'Client' },
  compute:  { color: '#0f766e', bg: 'rgba(15, 118, 110, 0.07)', label: 'Compute' },
  data:     { color: '#334155', bg: 'rgba(51, 65, 85, 0.08)',   label: 'Data' },
  async:    { color: '#c2410c', bg: 'rgba(194, 65, 12, 0.07)',  label: 'Async' },
  external: { color: '#57534e', bg: 'rgba(87, 83, 78, 0.07)',   label: 'External' },
};

/** Legacy tier keys → concern (kept for call sites). */
export const TIER_COLORS = {
  infrastructure: CONCERN_COLORS.client,
  security:       CONCERN_COLORS.compute,
  services:       CONCERN_COLORS.compute,
  async:          CONCERN_COLORS.async,
  database:       CONCERN_COLORS.data,
  cache:          CONCERN_COLORS.data,
} as const;

export type TierType = keyof typeof TIER_COLORS;

export function resolveConcern(category?: string): Concern {
  const cat = (category || '').toLowerCase();
  if (
    cat.includes('client') || cat.includes('browser') || cat.includes('frontend') ||
    cat.includes('mobile') || cat.includes('user') || cat.includes('ui')
  ) return 'client';
  if (
    cat.includes('queue') || cat.includes('message') || cat.includes('event') ||
    cat.includes('async') || cat.includes('kafka') || cat.includes('bus') || cat.includes('stream')
  ) return 'async';
  if (
    cat.includes('data') || cat.includes('db') || cat.includes('database') ||
    cat.includes('cache') || cat.includes('storage') || cat.includes('postgres') ||
    cat.includes('redis') || cat.includes('mongo')
  ) return 'data';
  if (
    cat.includes('external') || cat.includes('saas') || cat.includes('third') ||
    cat.includes('cdn') || cat.includes('cloud') || cat.includes('stripe')
  ) return 'external';
  if (
    cat.includes('edge') || cat.includes('gateway') || cat.includes('auth') ||
    cat.includes('security') || cat.includes('observe') || cat.includes('monitor')
  ) return 'compute';
  if (
    cat.includes('compute') || cat.includes('server') || cat.includes('worker') ||
    cat.includes('service') || cat.includes('api')
  ) return 'compute';
  return 'compute';
}

export function getConcernColor(category?: string, palette: Record<Concern, ConcernSwatch> = CONCERN_COLORS): string {
  return palette[resolveConcern(category)].color;
}

/** @deprecated Prefer getConcernColor — kept for existing imports. */
export function getTierColorNormalized(category?: string): string {
  return getConcernColor(category);
}

export const STATUS_COLORS = {
  healthy: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  unknown: '#6B7280',
};

export const EDGE_STYLES = {
  sync:    { color: '#000000', width: 1.5, dash: '',    animated: false },
  primary: { color: '#000000', width: 1.5, dash: '',     animated: false },
  async:   { color: '#000000', width: 1.5, dash: '6,5', animated: true },
} as const;

export const EDGE_MARKER_SIZE = { width: 22, height: 22 } as const;

/** Icon slot sizes — recognition first, quiet chip second. */
export const ICON_SIZE = {
  node: 30,
  cloudMin: 35,
  box: 45,
  boxLarge: 53,
  /** Diamonds stay compact — excluded from the enlarged icon treatment. */
  diamond: {
    node: 18,
    cloudMin: 20,
    box: 28,
  },
} as const;

export const FONTS = {
  body: '"Inter", "IBM Plex Sans", system-ui, -apple-system, sans-serif',
  display: '"Inter", "IBM Plex Sans", system-ui, sans-serif',
  titleSize: 13.5,
  titleWeight: 600,
  subtitleSize: 10.5,
  subtitleWeight: 400,
};

// ── Node surface styles ─────────────────────────────────────────────────────

export interface NodeStyleConfig {
  background: string;
  border: string;
  borderHover: string;
  shadow: string;
  shadowSelected: string;
  titleColor: string;
  subtitleColor: string;
  /** Stacked sticker backplates — always empty in the quiet system. */
  backplates: { offset: number; color: string }[];
}

export const LIGHT_NODE_STYLES: NodeStyleConfig = {
  background: '#ffffff',
  border: 'rgba(15, 23, 42, 0.16)',
  borderHover: 'rgba(15, 23, 42, 0.28)',
  shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  shadowSelected: '0 2px 8px rgba(15, 23, 42, 0.06)',
  titleColor: '#0f172a',
  subtitleColor: '#64748b',
  backplates: [],
};

export const DARK_NODE_STYLES: NodeStyleConfig = {
  background: '#1e293b',
  border: 'rgba(148, 163, 184, 0.18)',
  borderHover: 'rgba(148, 163, 184, 0.32)',
  shadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)',
  shadowSelected: '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(59, 130, 246, 0.15)',
  titleColor: '#f1f5f9',
  subtitleColor: '#cbd5e1',
  backplates: [],
};

// ── Diagram theme packs ─────────────────────────────────────────────────────

export type DiagramThemeId = 'default' | 'slate' | 'forest-green' | 'dark-minimal' | 'luxury';

export interface DiagramThemePack {
  id: DiagramThemeId;
  label: string;
  light: {
    canvasHint: string;
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
  dark: {
    canvasHint: string;
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
  concerns: Record<Concern, ConcernSwatch>;
}

function concern(color: string, bg: string, label: string): ConcernSwatch {
  return { color, bg, label };
}

export const DIAGRAM_THEMES: Record<DiagramThemeId, DiagramThemePack> = {
  default: {
    id: 'default',
    label: 'Default',
    light: {
      canvasHint: '#f8fafc',
      nodeFill: '#ffffff',
      nodeStroke: 'rgba(15, 23, 42, 0.2)',
      title: '#0f172a',
      subtitle: '#64748b',
      groupFill: 'rgba(15, 23, 42, 0.02)',
      groupStroke: 'rgba(15, 23, 42, 0.16)',
      edgeDefault: '#000000',
      edgePrimary: '#000000',
      edgeAsync: '#000000',
      shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    },
    dark: {
      canvasHint: '#0f172a',
      nodeFill: '#1e293b',
      nodeStroke: 'rgba(148, 163, 184, 0.18)',
      title: '#f1f5f9',
      subtitle: '#cbd5e1',
      groupFill: 'rgba(30, 41, 59, 0.5)',
      groupStroke: 'rgba(148, 163, 184, 0.2)',
      edgeDefault: '#f1f5f9',
      edgePrimary: '#f8fafc',
      edgeAsync: '#f8fafc',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.3)',
    },
    concerns: { ...CONCERN_COLORS },
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    light: {
      canvasHint: '#f1f5f9',
      nodeFill: '#ffffff',
      nodeStroke: 'rgba(30, 41, 59, 0.16)',
      title: '#0f172a',
      subtitle: '#64748b',
      groupFill: 'rgba(30, 41, 59, 0.03)',
      groupStroke: 'rgba(30, 41, 59, 0.14)',
      edgeDefault: '#000000',
      edgePrimary: '#000000',
      edgeAsync: '#000000',
      shadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
    },
    dark: {
      canvasHint: '#0f172a',
      nodeFill: '#1e293b',
      nodeStroke: 'rgba(148, 163, 184, 0.2)',
      title: '#f1f5f9',
      subtitle: '#cbd5e1',
      groupFill: 'rgba(30, 41, 59, 0.4)',
      groupStroke: 'rgba(148, 163, 184, 0.18)',
      edgeDefault: '#f1f5f9',
      edgePrimary: '#f8fafc',
      edgeAsync: '#f8fafc',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    },
    concerns: {
      client:   concern('#64748b', 'rgba(100,116,139,0.06)', 'Client'),
      compute:  concern('#334155', 'rgba(51,65,85,0.07)', 'Compute'),
      data:     concern('#475569', 'rgba(71,85,105,0.08)', 'Data'),
      async:    concern('#92400e', 'rgba(146,64,14,0.06)', 'Async'),
      external: concern('#78716c', 'rgba(120,113,108,0.06)', 'External'),
    },
  },
  'forest-green': {
    id: 'forest-green',
    label: 'Forest',
    light: {
      canvasHint: '#f4f7f4',
      nodeFill: '#fcfdfb',
      nodeStroke: 'rgba(22, 61, 40, 0.16)',
      title: '#14261a',
      subtitle: '#6b7c70',
      groupFill: 'rgba(22, 61, 40, 0.03)',
      groupStroke: 'rgba(22, 61, 40, 0.14)',
      edgeDefault: '#000000',
      edgePrimary: '#000000',
      edgeAsync: '#000000',
      shadow: '0 1px 2px rgba(22, 61, 40, 0.05)',
    },
    dark: {
      canvasHint: '#0f1f15',
      nodeFill: '#1a2e22',
      nodeStroke: 'rgba(134, 179, 149, 0.22)',
      title: '#ecfdf5',
      subtitle: '#a7f3d0',
      groupFill: 'rgba(16, 185, 129, 0.08)',
      groupStroke: 'rgba(134, 179, 149, 0.22)',
      edgeDefault: '#ecfdf5',
      edgePrimary: '#f0fdf4',
      edgeAsync: '#f0fdf4',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(16, 185, 129, 0.1)',
    },
    concerns: {
      client:   concern('#5c7364', 'rgba(92,115,100,0.07)', 'Client'),
      compute:  concern('#2f6b4f', 'rgba(47,107,79,0.08)', 'Compute'),
      data:     concern('#3f5e4c', 'rgba(63,94,76,0.08)', 'Data'),
      async:    concern('#a16207', 'rgba(161,98,7,0.07)', 'Async'),
      external: concern('#6b7280', 'rgba(107,114,128,0.06)', 'External'),
    },
  },
  'dark-minimal': {
    id: 'dark-minimal',
    label: 'Dark Minimal',
    light: {
      canvasHint: '#fafafa',
      nodeFill: '#ffffff',
      nodeStroke: 'rgba(0, 0, 0, 0.12)',
      title: '#171717',
      subtitle: '#a3a3a3',
      groupFill: 'rgba(0, 0, 0, 0.02)',
      groupStroke: 'rgba(0, 0, 0, 0.1)',
      edgeDefault: '#000000',
      edgePrimary: '#000000',
      edgeAsync: '#000000',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
    },
    dark: {
      canvasHint: '#18181b',
      nodeFill: '#27272a',
      nodeStroke: 'rgba(161, 161, 170, 0.18)',
      title: '#fafafa',
      subtitle: '#a1a1aa',
      groupFill: 'rgba(63, 63, 70, 0.4)',
      groupStroke: 'rgba(161, 161, 170, 0.2)',
      edgeDefault: '#fafafa',
      edgePrimary: '#ffffff',
      edgeAsync: '#ffffff',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
    },
    concerns: {
      client:   concern('#737373', 'rgba(115,115,115,0.08)', 'Client'),
      compute:  concern('#525252', 'rgba(82,82,82,0.1)', 'Compute'),
      data:     concern('#404040', 'rgba(64,64,64,0.1)', 'Data'),
      async:    concern('#a16207', 'rgba(161,98,7,0.08)', 'Async'),
      external: concern('#78716c', 'rgba(120,113,108,0.07)', 'External'),
    },
  },
  luxury: {
    id: 'luxury',
    label: 'Luxury',
    light: {
      canvasHint: '#f7f5f2',
      nodeFill: '#fffcf8',
      nodeStroke: 'rgba(55, 42, 30, 0.16)',
      title: '#2a2118',
      subtitle: '#8a7f72',
      groupFill: 'rgba(55, 42, 30, 0.03)',
      groupStroke: 'rgba(55, 42, 30, 0.12)',
      edgeDefault: '#000000',
      edgePrimary: '#000000',
      edgeAsync: '#000000',
      shadow: '0 2px 6px rgba(55, 42, 30, 0.05)',
    },
    dark: {
      canvasHint: '#1c1917',
      nodeFill: '#292524',
      nodeStroke: 'rgba(214, 201, 186, 0.2)',
      title: '#fafaf9',
      subtitle: '#d6d3d1',
      groupFill: 'rgba(120, 113, 108, 0.15)',
      groupStroke: 'rgba(214, 201, 186, 0.22)',
      edgeDefault: '#fafaf9',
      edgePrimary: '#ffffff',
      edgeAsync: '#ffffff',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 1px 4px rgba(120, 113, 108, 0.15)',
    },
    concerns: {
      client:   concern('#8a7f72', 'rgba(138,127,114,0.07)', 'Client'),
      compute:  concern('#5c4d3d', 'rgba(92,77,61,0.08)', 'Compute'),
      data:     concern('#6b5a48', 'rgba(107,90,72,0.08)', 'Data'),
      async:    concern('#9a3412', 'rgba(154,52,18,0.07)', 'Async'),
      external: concern('#78716c', 'rgba(120,113,108,0.06)', 'External'),
    },
  },
};

export function getDiagramTheme(id?: string | null): DiagramThemePack {
  if (id && id in DIAGRAM_THEMES) return DIAGRAM_THEMES[id as DiagramThemeId];
  return DIAGRAM_THEMES.default;
}

/** Build StyleConfig-compatible nodeTypeStyles from a theme pack. */
export function themeToNodeTypeStyles(themeId?: string | null): Record<string, string> {
  const pack = getDiagramTheme(themeId);
  const c = pack.concerns;
  return {
    client: c.client.color,
    edge: c.compute.color,
    gateway: c.compute.color,
    application: c.compute.color,
    compute: c.compute.color,
    data: c.data.color,
    queue: c.async.color,
    async: c.async.color,
    observability: c.compute.color,
    external: c.external.color,
  };
}

export function themePrimaryColor(themeId?: string | null): string {
  return getDiagramTheme(themeId).concerns.compute.color;
}

/** CSS custom properties for a theme pack (applied to canvas root). */
export function diagramThemeCssVars(themeId: string | null | undefined, isDark: boolean): Record<string, string> {
  const pack = getDiagramTheme(themeId);
  const mode = isDark ? pack.dark : pack.light;
  return {
    '--arch-node-fill': mode.nodeFill,
    '--arch-node-stroke': mode.nodeStroke,
    '--arch-title': mode.title,
    '--arch-subtitle': mode.subtitle,
    '--arch-group-fill': mode.groupFill,
    '--arch-group-stroke': mode.groupStroke,
    '--arch-edge-default': mode.edgeDefault,
    '--arch-edge-primary': mode.edgePrimary,
    '--arch-edge-async': mode.edgeAsync,
    '--arch-shadow': mode.shadow,
    '--arch-stroke-width': `${STROKE_WIDTH}px`,
    '--arch-radius': `${BORDER_RADIUS}px`,
    '--arch-size-s': `${SIZE_S}px`,
    '--arch-size-m': `${SIZE_M}px`,
    '--arch-size-l': `${SIZE_L}px`,
    '--node-card-bg': mode.nodeFill,
    '--node-title-color': mode.title,
    '--node-subtitle-color': mode.subtitle,
    '--node-shadow': mode.shadow,
  };
}
