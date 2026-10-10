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
// Dark mode keeps the heavy graphic outline, but inverted: a near-white
// border plus a solid light offset plate — the brutalist signature — instead
// of mid-slate tones that dissolve into the dark canvas. Fills stay deeply
// saturated (see getBrutalNodeFill) so concern colors read as jewel tones.
export const BRUTAL_FILL_DARK = '#12161d';
export const BRUTAL_BORDER_DARK = '#e8edf3';
export const BRUTAL_SHADOW_DARK = '#b9c6d8';
export const BRUTAL_GROUP_FILL_DARK = '#202a3a';
export const BRUTAL_CANVAS_BG_DARK = '225 12% 10%';
export const BRUTAL_GRID_DARK = '220 10% 18%';

export const BRUTAL_TITLE_DARK = '#f3f5f8';
export const BRUTAL_SUBTITLE_DARK = '#bac4d2';

export const BRUTAL_EDGE_DEFAULT_DARK = '#aab4c3';
export const BRUTAL_EDGE_PRIMARY_DARK = '#78b4f8';
export const BRUTAL_EDGE_ASYNC_DARK = '#b8a0ec';

/** Subtle concern tint while retaining the flat, hard-edged brutal surface. */
export function getBrutalNodeFill(accentColor: string, isDark: boolean): string {
  if (!/^#([0-9a-fA-F]{6})$/.test(accentColor)) return isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT;
  // Dark mode leans hard into the accent (jewel tones on near-black) —
  // a weak tint over slate is what made dark brutal look washed-out mud.
  const base = isDark ? [18, 22, 29] : [255, 255, 255];
  const tint = [1, 3, 5].map((offset) => parseInt(accentColor.slice(offset, offset + 2), 16));
  const amount = isDark ? 0.72 : 0.14;
  const mixed = base.map((channel, index) => Math.round(channel * (1 - amount) + tint[index] * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

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
