import {
  CONCERN_COLORS,
  resolveConcern,
  getConcernColor,
  type Concern,
} from './theme/stylingConstants';

/* ═══════════════════════════════════════════════════════════════
   Semantic concern colors — muted architectural accents.
   80–90% of the canvas stays neutral; accents encode concern.
   ═══════════════════════════════════════════════════════════════ */

export const TIER_THEME: Record<string, { main: string; light: string; dark: string }> = {
  client:   { main: CONCERN_COLORS.client.color,   light: '#f8fafc', dark: '#1e293b' },
  edge:     { main: CONCERN_COLORS.compute.color,  light: '#f0fdfa', dark: '#134e4a' },
  compute:  { main: CONCERN_COLORS.compute.color,  light: '#f0fdfa', dark: '#134e4a' },
  async:    { main: CONCERN_COLORS.async.color,    light: '#fffbeb', dark: '#78350f' },
  data:     { main: CONCERN_COLORS.data.color,     light: '#f8fafc', dark: '#1e293b' },
  observe:  { main: CONCERN_COLORS.compute.color,  light: '#f0fdfa', dark: '#134e4a' },
  external: { main: CONCERN_COLORS.external.color, light: '#f8fafc', dark: '#292524' },
  infrastructure: { main: CONCERN_COLORS.client.color, light: '#f8fafc', dark: '#1e293b' },
  security:       { main: CONCERN_COLORS.compute.color, light: '#f0fdfa', dark: '#134e4a' },
  services:       { main: CONCERN_COLORS.compute.color, light: '#f0fdfa', dark: '#134e4a' },
  database:       { main: CONCERN_COLORS.data.color, light: '#f8fafc', dark: '#1e293b' },
  cache:          { main: CONCERN_COLORS.data.color, light: '#f8fafc', dark: '#1e293b' },
};

export const ZONE_BACKGROUNDS: Record<Concern | string, string> = {
  client:   CONCERN_COLORS.client.bg,
  edge:     CONCERN_COLORS.compute.bg,
  compute:  CONCERN_COLORS.compute.bg,
  async:    CONCERN_COLORS.async.bg,
  data:     CONCERN_COLORS.data.bg,
  observe:  CONCERN_COLORS.compute.bg,
  external: CONCERN_COLORS.external.bg,
  infrastructure: CONCERN_COLORS.client.bg,
  security: CONCERN_COLORS.compute.bg,
  services: CONCERN_COLORS.compute.bg,
  database: CONCERN_COLORS.data.bg,
  cache: CONCERN_COLORS.data.bg,
};

export const ZONE_BACKGROUNDS_DARK: Record<Concern | string, string> = {
  client:   'rgba(100, 116, 139, 0.1)',
  edge:     'rgba(15, 118, 110, 0.1)',
  compute:  'rgba(15, 118, 110, 0.1)',
  async:    'rgba(180, 83, 9, 0.1)',
  data:     'rgba(71, 85, 105, 0.12)',
  observe:  'rgba(15, 118, 110, 0.1)',
  external: 'rgba(107, 114, 128, 0.1)',
  infrastructure: 'rgba(100, 116, 139, 0.1)',
  security: 'rgba(15, 118, 110, 0.1)',
  services: 'rgba(15, 118, 110, 0.1)',
  database: 'rgba(71, 85, 105, 0.12)',
  cache: 'rgba(71, 85, 105, 0.12)',
};

/**
 * Returns the canonical color for an architectural tier/concern.
 */
export function getTierColor(tier?: string, _isDark = false): string {
  return getConcernColor(tier);
}

/**
 * Returns a semi-transparent background color for an architectural zone/group.
 */
export function getZoneBackground(tier?: string, isDark = false): string {
  const concern = resolveConcern(tier);
  if (isDark) return ZONE_BACKGROUNDS_DARK[concern] ?? ZONE_BACKGROUNDS_DARK.compute;
  return ZONE_BACKGROUNDS[concern] ?? ZONE_BACKGROUNDS.compute;
}
