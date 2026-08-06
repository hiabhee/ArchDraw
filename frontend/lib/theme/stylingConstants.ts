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
export const NODE_HEIGHT = 88;
/** Max layout height for diamond/circle so ELK lanes stay aligned with rects. */
export const SHAPE_LANE_HEIGHT_CAP = 96;
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
  sync:    { color: '#94a3b8', width: 1.25, dash: '',    animated: false },
  primary: { color: FLOW_ACCENT, width: 2, dash: '',     animated: false },
  async:   { color: '#c2410c', width: 1.25, dash: '6,5', animated: true },
} as const;

export const EDGE_MARKER_SIZE = { width: 22, height: 22 } as const;

/** Icon slot sizes — recognition first, quiet chip second. */
export const ICON_SIZE = {
  node: 18,
  cloudMin: 20,
  box: 28,
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
  shadowSelected: `0 0 0 2px ${FLOW_ACCENT}99, 0 2px 8px rgba(15, 23, 42, 0.06)`,
  titleColor: '#0f172a',
  subtitleColor: '#64748b',
  backplates: [],
};

export const DARK_NODE_STYLES: NodeStyleConfig = {
  background: '#1a1d27',
  border: 'rgba(255, 255, 255, 0.18)',
  borderHover: 'rgba(255, 255, 255, 0.28)',
  shadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
  shadowSelected: `0 0 0 2px ${FLOW_ACCENT}aa, 0 2px 8px rgba(0, 0, 0, 0.4)`,
  titleColor: '#f8fafc',
  subtitleColor: '#94a3b8',
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
      edgeDefault: '#64748b',
      edgePrimary: '#000000',
      edgeAsync: '#b45309',
      shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    },
    dark: {
      canvasHint: '#0f1117',
      nodeFill: '#1a1d27',
      nodeStroke: 'rgba(255, 255, 255, 0.18)',
      title: '#f8fafc',
      subtitle: '#94a3b8',
      groupFill: 'rgba(255, 255, 255, 0.03)',
      groupStroke: 'rgba(255, 255, 255, 0.16)',
      edgeDefault: '#94a3b8',
      edgePrimary: '#ffffff',
      edgeAsync: '#d97706',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
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
      edgeDefault: '#94a3b8',
      edgePrimary: '#475569',
      edgeAsync: '#92400e',
      shadow: 'none',
    },
    dark: {
      canvasHint: '#0b1220',
      nodeFill: '#151b28',
      nodeStroke: 'rgba(148, 163, 184, 0.22)',
      title: '#e2e8f0',
      subtitle: '#94a3b8',
      groupFill: 'rgba(148, 163, 184, 0.04)',
      groupStroke: 'rgba(148, 163, 184, 0.18)',
      edgeDefault: '#64748b',
      edgePrimary: '#94a3b8',
      edgeAsync: '#d97706',
      shadow: 'none',
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
      edgeDefault: '#8fa094',
      edgePrimary: '#3d5a45',
      edgeAsync: '#a16207',
      shadow: '0 1px 2px rgba(22, 61, 40, 0.05)',
    },
    dark: {
      canvasHint: '#0c1410',
      nodeFill: '#141c17',
      nodeStroke: 'rgba(134, 179, 149, 0.2)',
      title: '#e8f0ea',
      subtitle: '#8fa094',
      groupFill: 'rgba(134, 179, 149, 0.04)',
      groupStroke: 'rgba(134, 179, 149, 0.16)',
      edgeDefault: '#5c7364',
      edgePrimary: '#a3bfad',
      edgeAsync: '#ca8a04',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
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
      edgeDefault: '#a3a3a3',
      edgePrimary: '#525252',
      edgeAsync: '#a16207',
      shadow: 'none',
    },
    dark: {
      canvasHint: '#09090b',
      nodeFill: '#121214',
      nodeStroke: 'rgba(255, 255, 255, 0.1)',
      title: '#fafafa',
      subtitle: '#737373',
      groupFill: 'rgba(255, 255, 255, 0.02)',
      groupStroke: 'rgba(255, 255, 255, 0.1)',
      edgeDefault: '#525252',
      edgePrimary: '#a3a3a3',
      edgeAsync: '#ca8a04',
      shadow: 'none',
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
      edgeDefault: '#b0a69a',
      edgePrimary: '#5c4d3d',
      edgeAsync: '#9a3412',
      shadow: '0 2px 6px rgba(55, 42, 30, 0.05)',
    },
    dark: {
      canvasHint: '#12100e',
      nodeFill: '#1a1714',
      nodeStroke: 'rgba(214, 201, 186, 0.16)',
      title: '#f5efe6',
      subtitle: '#a89f93',
      groupFill: 'rgba(214, 201, 186, 0.03)',
      groupStroke: 'rgba(214, 201, 186, 0.12)',
      edgeDefault: '#6e655a',
      edgePrimary: '#d6c9ba',
      edgeAsync: '#c2410c',
      shadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
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
