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
// border and a solid near-white offset plate (the brutalist signature, as the
// black border and shadow are in light mode). Cards are deep, saturated jewel
// tones with light ink (see getBrutalNodeFill): rich rather than bright, and
// not the greyed-out mid-tones that read as mud on a dark canvas.
export const BRUTAL_FILL_DARK = '#12161d';
export const BRUTAL_BORDER_DARK = '#e8edf3';
export const BRUTAL_SHADOW_DARK = '#e8edf3';
export const BRUTAL_GROUP_FILL_DARK = '#202a3a';
export const BRUTAL_CANVAS_BG_DARK = '225 12% 10%';
export const BRUTAL_GRID_DARK = '220 10% 18%';

export const BRUTAL_TITLE_DARK = '#f3f5f8';
export const BRUTAL_SUBTITLE_DARK = '#bac4d2';

/** Ink on a card in dark mode (title / subtitle): light text on the deep jewel-tone fills. */
export const BRUTAL_NODE_INK_DARK = '#f6f7fa';
export const BRUTAL_NODE_INK_SOFT_DARK = '#d3dae6';

// Dark edges: soft light connectors with a calm blue for the main flow and lilac for async. They
// read clearly on the dark canvas without glowing.
export const BRUTAL_EDGE_DEFAULT_DARK = '#c9d1de';
export const BRUTAL_EDGE_PRIMARY_DARK = '#8fb3ee';
export const BRUTAL_EDGE_ASYNC_DARK = '#b3a2e0';

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[0, 8, 4].map((n) => channel(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Flat card fill from the concern colour. The hue stays (it carries the meaning: client, compute,
 * data...), but saturation and lightness are set directly so every card is a strong flat colour
 * rather than a pastel or a grey-ish mid-tone: a deep jewel tone in dark mode, a lighter but still
 * colourful block in light mode.
 */
export function getBrutalNodeFill(accentColor: string, isDark: boolean): string {
  if (!/^#([0-9a-fA-F]{6})$/.test(accentColor)) return isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT;
  const [h, s] = hexToHsl(accentColor);
  // A grey accent stays grey; a colour is pushed to a strong, even saturation.
  const saturation = s < 0.12 ? s * 0.5 : isDark ? 0.58 : 0.88;
  if (!isDark) return hslToHex(h, saturation, 0.84);
  // Hues differ a lot in perceived brightness (a green at the same lightness as a blue is far
  // brighter), so lightness is lowered until the fill is dark enough for light text on every hue.
  let lightness = 0.38;
  let fill = hslToHex(h, saturation, lightness);
  while (relativeLuminance(fill) > 0.075 && lightness > 0.12) {
    lightness -= 0.01;
    fill = hslToHex(h, saturation, lightness);
  }
  return fill;
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
