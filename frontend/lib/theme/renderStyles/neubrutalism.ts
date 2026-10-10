import type { RenderStylePack } from './types';

// ── Palette ──────────────────────────────────────────────────────────────────

/** Near-black border / shadow — the signature of neubrutalism. */
export const BRUTAL_BORDER = '#1a1a1a';
export const BRUTAL_SHADOW = '#1a1a1a';
export const BRUTAL_SHADOW_OFFSET = 5;

// ── Light mode ───────────────────────────────────────────────────────────────

export const BRUTAL_FILL_LIGHT = '#ffffff';
export const BRUTAL_GROUP_FILL_LIGHT = '#dbeafe';
export const BRUTAL_CANVAS_BG_LIGHT = '210 20% 98%';
export const BRUTAL_GRID_LIGHT = '220 14% 90%';

export const BRUTAL_TITLE_LIGHT = '#1a1a1a';
export const BRUTAL_SUBTITLE_LIGHT = '#52525b';

export const BRUTAL_EDGE_DEFAULT_LIGHT = '#1a1a1a';
export const BRUTAL_EDGE_PRIMARY_LIGHT = '#2563eb';
export const BRUTAL_EDGE_ASYNC_LIGHT = '#7c3aed';

// ── Dark mode ────────────────────────────────────────────────────────────────
// Refined 2026-09: previous #1e1e2e fill + 7 % canvas were too muddy and
// low-contrast; the 5 px offset shadow (black on near-black) vanished, so
// dark brutal looked flat / “ugly”. Lift canvas to zinc-900, make fills a
// touch lighter and warmer, and keep the brutal grammar (light border +
// light offset shadow on dark, per neubrutalism.com dark-section rule).

export const BRUTAL_FILL_DARK = '#27272f';
export const BRUTAL_BORDER_DARK = '#e4e4e7';
export const BRUTAL_SHADOW_DARK = '#e4e4e7';
export const BRUTAL_GROUP_FILL_DARK = '#dbeafe';
export const BRUTAL_CANVAS_BG_DARK = '240 5% 12%';
export const BRUTAL_GRID_DARK = '240 5% 20%';

export const BRUTAL_TITLE_DARK = '#fafafa';
export const BRUTAL_SUBTITLE_DARK = '#cbd5e1';

export const BRUTAL_EDGE_DEFAULT_DARK = '#e4e4e7';
export const BRUTAL_EDGE_PRIMARY_DARK = '#60a5fa';
export const BRUTAL_EDGE_ASYNC_DARK = '#a78bfa';

/** SVG filter definition for hard drop-shadows. Inject once per SVG root. */
export const BRUTAL_SHADOW_FILTER_ID = 'brutal-shadow';
export const BRUTAL_SHADOW_FILTER = `
  <defs>
    <filter id="${BRUTAL_SHADOW_FILTER_ID}" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="${BRUTAL_SHADOW_OFFSET}" dy="${BRUTAL_SHADOW_OFFSET}" stdDeviation="0" flood-color="${BRUTAL_SHADOW}" flood-opacity="1"/>
    </filter>
  </defs>
`.trim();

export const BRUTAL_SHADOW_FILTER_ID_DARK = 'brutal-shadow-dark';
export const BRUTAL_SHADOW_FILTER_DARK = `
  <defs>
    <filter id="${BRUTAL_SHADOW_FILTER_ID_DARK}" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="${BRUTAL_SHADOW_OFFSET}" dy="${BRUTAL_SHADOW_OFFSET}" stdDeviation="0" flood-color="${BRUTAL_SHADOW_DARK}" flood-opacity="1"/>
    </filter>
  </defs>
`.trim();

/** Helper for callers that need the correct filter per theme. */
export function brutalShadowFilterId(isDark: boolean): string {
  return isDark ? BRUTAL_SHADOW_FILTER_ID_DARK : BRUTAL_SHADOW_FILTER_ID;
}
export function brutalShadowFilter(isDark: boolean): string {
  return isDark ? BRUTAL_SHADOW_FILTER_DARK : BRUTAL_SHADOW_FILTER;
}

/**
 * Neubrutalism render style — bold, heavy borders, hard offset shadows,
 * flat saturated fills, geometric sans-serif type.
 */
export const NEUBRUTALISM_RENDER_STYLE: RenderStylePack = {
  id: 'neubrutalism',
  label: 'Neubrutalism',
  description: 'Bold borders, hard shadows, flat colour — unapologetically graphic.',
  strokeEngine: 'brutalist',

  fonts: {
    title: '"Space Grotesk", "Inter", system-ui, sans-serif',
    subtitle: '"Space Grotesk", "Inter", system-ui, sans-serif',
    edgeLabel: '"JetBrains Mono", "Space Grotesk", monospace',
    annotation: '"Space Grotesk", system-ui, sans-serif',
    googleFontFamily: 'Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600',
  },

  geometry: {
    borderRadiusScale: 0.6,
    strokeWidthScale: 2.6,
    labelPaddingX: 2,
    labelPaddingY: 1,
    sizeGridNudge: 0,
    dropShadow: 'hard',
  },

  edges: {
    pathStyle: 'orthogonal-brutal',
    arrowheadStyle: 'filled-brutal',
    labelBackground: 'brutal-pill',
    animatedAsync: true,
  },

  groups: {
    borderStyle: 'brutal-solid',
    labelStyle: 'brutalist',
    fillOpacity: 1,
  },

  icons: {
    mode: 'sharp',
  },
};
