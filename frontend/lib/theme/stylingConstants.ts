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
  /** Higher luminance variant used on dark canvases. */
  darkColor?: string;
  darkBg?: string;
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
  body: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
  display: 'var(--font-instrument-serif), Georgia, serif',
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

export type DiagramThemeId = 'default' | 'slate' | 'forest-green' | 'dark-minimal' | 'studio-minimal' | 'luxury';
export const DEFAULT_DIAGRAM_THEME_ID: DiagramThemeId = 'studio-minimal';

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

function concern(
  color: string,
  bg: string,
  label: string,
  darkColor?: string,
  darkBg?: string,
): ConcernSwatch {
  return { color, bg, label, darkColor, darkBg };
}

export const DIAGRAM_THEMES: Record<DiagramThemeId, DiagramThemePack> = {
  default: {
    id: 'default',
    label: 'Default',
    light: {
      canvasHint: '#f8fafc',
      nodeFill: '#ffffff',
      nodeStroke: 'rgba(49, 68, 95, 0.19)',
      title: '#19263a',
      subtitle: '#586981',
      groupFill: 'rgba(40, 101, 204, 0.035)',
      groupStroke: 'rgba(57, 91, 145, 0.24)',
      edgeDefault: '#6f7e92',
      edgePrimary: '#2865cc',
      edgeAsync: '#c45a28',
      shadow: '0 2px 4px rgba(22, 38, 62, 0.045), 0 8px 22px rgba(22, 38, 62, 0.025)',
    },
    dark: {
      canvasHint: '#101722',
      nodeFill: '#192333',
      nodeStroke: 'rgba(171, 190, 217, 0.23)',
      title: '#eff4fb',
      subtitle: '#b0bed1',
      groupFill: 'rgba(79, 125, 197, 0.10)',
      groupStroke: 'rgba(144, 176, 222, 0.34)',
      edgeDefault: '#a3b1c4',
      edgePrimary: '#8ab4ff',
      edgeAsync: '#ffad78',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.26), 0 1px 3px rgba(0, 0, 0, 0.32)',
    },
    concerns: {
      client: concern('#2456a6', 'rgba(36, 86, 166, 0.09)', 'Client', '#91b8ff', 'rgba(94, 145, 230, 0.2)'),
      compute: concern('#0b735c', 'rgba(11, 115, 92, 0.09)', 'Compute', '#6ae0b8', 'rgba(56, 189, 148, 0.2)'),
      data: concern('#6542af', 'rgba(101, 66, 175, 0.09)', 'Data', '#c2a6ff', 'rgba(142, 105, 220, 0.2)'),
      async: concern('#a84e12', 'rgba(168, 78, 18, 0.09)', 'Async', '#ffc078', 'rgba(206, 125, 48, 0.2)'),
      external: concern('#a43868', 'rgba(164, 56, 104, 0.08)', 'External', '#f6a4c6', 'rgba(207, 97, 146, 0.2)'),
    },
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    light: {
      canvasHint: '#edf2f7',
      nodeFill: '#fbfcfe',
      nodeStroke: 'rgba(71, 85, 105, 0.2)',
      title: '#1b2737',
      subtitle: '#566779',
      groupFill: 'rgba(71, 101, 139, 0.055)',
      groupStroke: 'rgba(71, 85, 105, 0.22)',
      edgeDefault: '#6c7b8d',
      edgePrimary: '#385e97',
      edgeAsync: '#a66a3e',
      shadow: '0 2px 5px rgba(28, 43, 61, 0.05), 0 10px 26px rgba(28, 43, 61, 0.025)',
    },
    dark: {
      canvasHint: '#111923',
      nodeFill: '#1b2633',
      nodeStroke: 'rgba(174, 191, 210, 0.22)',
      title: '#e8eef5',
      subtitle: '#adbac9',
      groupFill: 'rgba(128, 155, 188, 0.1)',
      groupStroke: 'rgba(174, 191, 210, 0.25)',
      edgeDefault: '#a7b4c2',
      edgePrimary: '#98b8ed',
      edgeAsync: '#e2aa80',
      shadow: '0 7px 20px rgba(0, 0, 0, 0.3)',
    },
    concerns: {
      client: concern('#4a607c', 'rgba(74, 96, 124, 0.08)', 'Client', '#a8beda', 'rgba(133, 160, 191, 0.2)'),
      compute: concern('#3b566c', 'rgba(59, 86, 108, 0.08)', 'Compute', '#9dc3d5', 'rgba(97, 148, 171, 0.2)'),
      data: concern('#596782', 'rgba(89, 103, 130, 0.08)', 'Data', '#b5c4e1', 'rgba(126, 146, 187, 0.2)'),
      async: concern('#8f5f3b', 'rgba(143, 95, 59, 0.08)', 'Async', '#e4b38b', 'rgba(185, 128, 84, 0.2)'),
      external: concern('#65716f', 'rgba(101, 113, 111, 0.08)', 'External', '#b8c7c3', 'rgba(132, 154, 148, 0.2)'),
    },
  },
  'forest-green': {
    id: 'forest-green',
    label: 'Forest',
    light: {
      canvasHint: '#eff5ef',
      nodeFill: '#fbfdf9',
      nodeStroke: 'rgba(42, 82, 57, 0.22)',
      title: '#183126',
      subtitle: '#4f6558',
      groupFill: 'rgba(40, 112, 70, 0.05)',
      groupStroke: 'rgba(52, 112, 75, 0.25)',
      edgeDefault: '#5b735f',
      edgePrimary: '#26724a',
      edgeAsync: '#ab641a',
      shadow: '0 2px 5px rgba(24, 49, 38, 0.045), 0 10px 24px rgba(24, 49, 38, 0.025)',
    },
    dark: {
      canvasHint: '#0d1a13',
      nodeFill: '#17291f',
      nodeStroke: 'rgba(152, 192, 160, 0.24)',
      title: '#edf6ee',
      subtitle: '#b1c7b7',
      groupFill: 'rgba(76, 151, 94, 0.12)',
      groupStroke: 'rgba(139, 192, 151, 0.34)',
      edgeDefault: '#a9c2ae',
      edgePrimary: '#70d79f',
      edgeAsync: '#f0b465',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(11, 34, 20, 0.3)',
    },
    concerns: {
      client: concern('#38634c', 'rgba(56, 99, 76, 0.08)', 'Client', '#a7d3b4', 'rgba(88, 153, 108, 0.2)'),
      compute: concern('#1c6a49', 'rgba(28, 106, 73, 0.09)', 'Compute', '#6ad5a0', 'rgba(55, 167, 111, 0.2)'),
      data: concern('#3f6a61', 'rgba(63, 106, 97, 0.08)', 'Data', '#91cabb', 'rgba(74, 153, 137, 0.2)'),
      async: concern('#995b0e', 'rgba(153, 91, 14, 0.08)', 'Async', '#f0b45f', 'rgba(185, 123, 35, 0.2)'),
      external: concern('#6b5c3b', 'rgba(107, 92, 59, 0.08)', 'External', '#ccb98e', 'rgba(153, 130, 78, 0.2)'),
    },
  },
  'dark-minimal': {
    id: 'dark-minimal',
    label: 'Dark Minimal',
    light: {
      canvasHint: '#f2f3f4',
      nodeFill: '#ffffff',
      nodeStroke: 'rgba(50, 56, 65, 0.17)',
      title: '#202329',
      subtitle: '#555d68',
      groupFill: 'rgba(65, 73, 83, 0.035)',
      groupStroke: 'rgba(65, 73, 83, 0.18)',
      edgeDefault: '#727982',
      edgePrimary: '#343a43',
      edgeAsync: '#a26b42',
      shadow: '0 1px 3px rgba(26, 30, 36, 0.045), 0 7px 18px rgba(26, 30, 36, 0.02)',
    },
    dark: {
      canvasHint: '#111318',
      nodeFill: '#1a1d23',
      nodeStroke: 'rgba(170, 178, 190, 0.22)',
      title: '#eef0f4',
      subtitle: '#b8bec7',
      groupFill: 'rgba(185, 194, 207, 0.06)',
      groupStroke: 'rgba(185, 194, 207, 0.2)',
      edgeDefault: '#aab1ba',
      edgePrimary: '#f2f4f7',
      edgeAsync: '#e0a36f',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.34)',
    },
    concerns: {
      client: concern('#59616d', 'rgba(89, 97, 109, 0.075)', 'Client', '#bbc2cc', 'rgba(145, 157, 174, 0.19)'),
      compute: concern('#3f4854', 'rgba(63, 72, 84, 0.075)', 'Compute', '#e0e5ec', 'rgba(174, 187, 204, 0.18)'),
      data: concern('#5a6572', 'rgba(90, 101, 114, 0.075)', 'Data', '#adb9c7', 'rgba(137, 153, 173, 0.19)'),
      async: concern('#885a36', 'rgba(136, 90, 54, 0.075)', 'Async', '#e4b381', 'rgba(177, 126, 83, 0.2)'),
      external: concern('#626b73', 'rgba(98, 107, 115, 0.075)', 'External', '#adb7c1', 'rgba(142, 154, 168, 0.19)'),
    },
  },
  'studio-minimal': {
    id: 'studio-minimal',
    label: 'Studio Minimal',
    light: {
      // A quiet editorial surface: warm white, hairline blue-gray structure,
      // and just enough lift to separate cards from the canvas.
      canvasHint: '#f6f7f9',
      nodeFill: '#fcfcfd',
      nodeStroke: 'rgba(120, 133, 154, 0.27)',
      title: '#172033',
      subtitle: '#647286',
      groupFill: 'rgba(48, 85, 130, 0.045)',
      groupStroke: 'rgba(93, 119, 157, 0.34)',
      edgeDefault: '#738198',
      edgePrimary: '#356ad2',
      edgeAsync: '#d45f3b',
      shadow: '0 2px 5px rgba(21, 33, 52, 0.05), 0 10px 26px rgba(21, 33, 52, 0.025)',
    },
    dark: {
      // Blue-charcoal keeps contrast high without crushing the canvas to black.
      canvasHint: '#101318',
      nodeFill: '#191d24',
      nodeStroke: 'rgba(185, 198, 217, 0.19)',
      title: '#f0f2f6',
      subtitle: '#aeb8c7',
      groupFill: 'rgba(160, 178, 204, 0.055)',
      groupStroke: 'rgba(160, 178, 204, 0.2)',
      edgeDefault: '#a7b2c4',
      edgePrimary: '#82aaff',
      edgeAsync: '#ff9a70',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.34), 0 1px 3px rgba(0, 0, 0, 0.4)',
    },
    concerns: {
      client: concern('#2864d8', 'rgba(40, 100, 216, 0.12)', 'Client', '#8fb6ff', 'rgba(66, 121, 226, 0.22)'),
      compute: concern('#008f6b', 'rgba(0, 143, 107, 0.12)', 'Compute', '#5ed6b2', 'rgba(0, 143, 107, 0.22)'),
      data: concern('#7558d8', 'rgba(117, 88, 216, 0.12)', 'Data', '#b9a3ff', 'rgba(117, 88, 216, 0.22)'),
      async: concern('#d65332', 'rgba(214, 83, 50, 0.11)', 'Async', '#ff9b7b', 'rgba(214, 83, 50, 0.22)'),
      external: concern('#b83878', 'rgba(184, 56, 120, 0.1)', 'External', '#f08dba', 'rgba(184, 56, 120, 0.2)'),
    },
  },
  luxury: {
    id: 'luxury',
    label: 'Luxury',
    light: {
      canvasHint: '#f7f5f2',
      nodeFill: '#fffcf8',
      nodeStroke: 'rgba(89, 65, 42, 0.2)',
      title: '#30251a',
      subtitle: '#6d5f51',
      groupFill: 'rgba(149, 113, 60, 0.055)',
      groupStroke: 'rgba(130, 96, 52, 0.23)',
      edgeDefault: '#7e705f',
      edgePrimary: '#8b6a36',
      edgeAsync: '#b6533a',
      shadow: '0 2px 5px rgba(64, 44, 25, 0.05), 0 9px 24px rgba(64, 44, 25, 0.025)',
    },
    dark: {
      canvasHint: '#1d1712',
      nodeFill: '#2a211a',
      nodeStroke: 'rgba(226, 205, 177, 0.22)',
      title: '#f5ecde',
      subtitle: '#d1c1aa',
      groupFill: 'rgba(198, 151, 89, 0.1)',
      groupStroke: 'rgba(221, 184, 126, 0.25)',
      edgeDefault: '#c7b7a3',
      edgePrimary: '#e6c27c',
      edgeAsync: '#f19c82',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.34), 0 1px 4px rgba(26, 17, 10, 0.35)',
    },
    concerns: {
      client: concern('#3e6a56', 'rgba(62, 106, 86, 0.08)', 'Client', '#a7ccb7', 'rgba(89, 147, 117, 0.2)'),
      compute: concern('#855b2c', 'rgba(133, 91, 44, 0.085)', 'Compute', '#d7b279', 'rgba(172, 126, 64, 0.2)'),
      data: concern('#6b4e3a', 'rgba(107, 78, 58, 0.08)', 'Data', '#d0ae94', 'rgba(148, 104, 74, 0.2)'),
      async: concern('#a44831', 'rgba(164, 72, 49, 0.08)', 'Async', '#f09a7f', 'rgba(184, 89, 63, 0.2)'),
      external: concern('#71517b', 'rgba(113, 81, 123, 0.08)', 'External', '#cba4d5', 'rgba(150, 105, 163, 0.2)'),
    },
  },
};

export function getDiagramTheme(id?: string | null): DiagramThemePack {
  if (id && id in DIAGRAM_THEMES) return DIAGRAM_THEMES[id as DiagramThemeId];
  return DIAGRAM_THEMES[DEFAULT_DIAGRAM_THEME_ID];
}

/** Resolve semantic accents to the contrast-safe light or dark swatches. */
export function resolveThemeConcerns(theme: DiagramThemePack, isDark: boolean): Record<Concern, ConcernSwatch> {
  return Object.fromEntries(
    (Object.entries(theme.concerns) as [Concern, ConcernSwatch][]).map(([key, swatch]) => [key, {
      ...swatch,
      color: isDark ? swatch.darkColor ?? swatch.color : swatch.color,
      bg: isDark ? swatch.darkBg ?? swatch.bg : swatch.bg,
    }]),
  ) as Record<Concern, ConcernSwatch>;
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
    '--arch-canvas-bg': mode.canvasHint,
    '--arch-canvas-grid': `color-mix(in srgb, ${mode.edgeDefault} ${isDark ? 22 : 14}%, transparent)`,
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
