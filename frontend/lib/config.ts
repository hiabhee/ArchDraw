import type { MarkerType, BackgroundVariant, ConnectionMode } from 'reactflow';

// ─── CANVAS ──────────────────────────────────────────────────

export const CANVAS_CONFIG = {
  snapToGrid:        true,
  snapGrid:          [20, 20] as [number, number],
  minZoom:           0.1,
  maxZoom:           3,
  connectionMode:    'loose' as ConnectionMode,
  /** Snap to nearest handle when dropping within this radius (px). 32 keeps
   * empty-pane drops easy (edge-drop new node) while still snapping when
   * you intentionally hover a handle. */
  connectionRadius:  32,
  background: {
    variant:         'dots' as BackgroundVariant,
    gap:             20,
    size:            1,
    color:           '#334155',
  },
} as const;

// ─── EDGES ───────────────────────────────────────────────────

export const EDGE_CONFIG = {
  type:              'smoothstep',
  animated:          true,
  strokeWidth:       1.25,
  strokeColor:       '#64748b',
  strokeColorOverlap:'#475569',
  /** Primary request-path accent (DodgerBlue / brand). */
  strokeColorPrimary:'#1E90FF',
  markerType:        'arrowclosed' as MarkerType,
  markerWidth:       22,
  markerHeight:      22,
  label: {
    fontSize:        9,
    letterSpacing:   '0.04em',
    background:      'rgba(100,116,139,0.12)',
    padding:         '2px 5px',
    borderRadius:    '3px',
  },
} as const;

// derived — use these directly in <ReactFlow />
export const DEFAULT_EDGE_OPTIONS = {
  type:      EDGE_CONFIG.type,
  animated:  EDGE_CONFIG.animated,
  style: {
    strokeWidth: EDGE_CONFIG.strokeWidth,
    stroke:      EDGE_CONFIG.strokeColor,
  },
  markerEnd: {
    type:   EDGE_CONFIG.markerType,
    color:  EDGE_CONFIG.strokeColor,
    width:  EDGE_CONFIG.markerWidth,
    height: EDGE_CONFIG.markerHeight,
  },
};

// ─── NODES ───────────────────────────────────────────────────

export const NODE_CONFIG = {
  defaultWidth:      200,
  defaultHeight:     100,
  duplicateOffset:   40,
  defaultType:       'custom',
  fallback: {
    color:           '#0f766e',
    category:        'default',
    icon:            'Box',
    label:           'Unnamed',
  },
} as const;

// ─── LAYOUT ──────────────────────────────────────────────────
// Frontend layout is Dagre-only via `lib/pipeline-shared/layout` (the ELK
// stack was removed; ELK now lives only in mcp-server). Spacing defaults:
// `defaultCompoundLayoutOptions` in lib/pipeline-shared/layout/LayoutEngine.ts.

// ─── NODE SPACING (global minimums) ───────────────────────────

export const MIN_HORIZONTAL_SPACING = 60;
export const MIN_VERTICAL_SPACING   = 100;

// ─── STORAGE ─────────────────────────────────────────────────

export const STORAGE_VERSION = 2;

export const STORAGE_KEYS = {
  theme: 'archdraw-theme',
  guestCanvases: 'guestCanvases',
  pendingAction: 'pendingAction',
  guideDismissed: 'archdraw_guide_dismissed',
  customComponents: 'archdraw_custom_components',
  introCount: 'archdraw-intro-shown-count',
  state: typeof window !== 'undefined' ? window.location.port : 'archdraw-state',
} as const;

export const STORAGE_KEY = STORAGE_KEYS.state; // Backwards compatibility for existing code

// ─── THEME ───────────────────────────────────────────────────

export const THEME = {
  accent:          '#3b82f6',
  mutedText:       '#94a3b8',
  border:          'rgba(255,255,255,0.08)',
  cardBg:          '#1e293b',
  canvasBg:        '#0f172a',
} as const;
