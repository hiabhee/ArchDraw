import type { CommunicationType, TierType } from '../types/index.js';

/**
 * Canonical MCP constants — the single source of truth for the tier palette,
 * tier ordering, communication styles, and fallback positions.
 *
 * This palette matches the tool contract (index.ts descriptions + read_me) and
 * is deliberately kept in one place so generate / update / layout / templates /
 * validation never drift from each other. If a color must change, change it
 * here and in the corresponding frontend theme documentation.
 */

export const TIER_ORDER: TierType[] = [
  'client',
  'edge',
  'compute',
  'async',
  'data',
  'external',
  'observe',
];

/** Tier rank for direction/topology checks — lower number = further upstream (left). */
export const TIER_RANK: Record<TierType, number> = {
  client: 0,
  edge: 1,
  compute: 2,
  async: 3,
  data: 4,
  external: 5,
  observe: 6,
};

export const TIER_COLORS: Record<TierType, string> = {
  client:   '#64748b', // slate
  edge:     '#6366f1', // indigo
  compute:  '#0d9488', // teal
  async:    '#d97706', // amber
  data:     '#3b82f6', // blue
  external: '#8b5cf6', // violet
  observe:  '#6b7280', // gray
};

export interface CommStyle {
  color: string;
  dash: string;
  animated: boolean;
}

export const COMM_COLORS: Record<CommunicationType, CommStyle> = {
  sync:   { color: '#94a3b8', dash: '',    animated: false },
  async:  { color: '#f59e0b', dash: '8,4', animated: true },
  stream: { color: '#10b981', dash: '4,2', animated: true },
  event:  { color: '#ec4899', dash: '2,3', animated: true },
  dep:    { color: '#94a3b8', dash: '6,6', animated: false },
};

export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 100;
export const DEFAULT_GROUP_WIDTH = 500;
export const DEFAULT_GROUP_HEIGHT = 280;

/** Fallback tier column positions (LEFT-RIGHT layout). */
export const TIER_X_POSITIONS_LR: Record<TierType, number> = {
  client: 50,
  edge: 400,
  compute: 750,
  async: 1200,
  data: 1550,
  external: 1900,
  observe: 2250,
};

export type LayoutDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';

export function isTier(value: string | undefined): value is TierType {
  return !!value && TIER_ORDER.includes(value.toLowerCase() as TierType);
}
