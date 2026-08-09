/**
 * @deprecated Legacy shape vocabulary (pill/stack/queue/dashed-rect …).
 * The canonical silhouette set + variant/service-type mapping now lives in
 * `frontend/lib/shapeRegistry.ts` (`VARIANT_TO_SHAPE`, `shapeForServiceType`).
 * Kept for call sites that still read `getShapeConfig` / `getNodeShape`; do not
 * extend this module — add new shapes to `shapeRegistry` instead.
 */
export type NodeShape = 
  | 'rounded-square'
  | 'pill'
  | 'cylinder'
  | 'stack'
  | 'queue'
  | 'dashed-rect'
  | 'shield'
  | 'minimal'
  | 'gradient-glow'
  | 'worker';

export type NodeSize = 'small' | 'normal' | 'medium' | 'large';

/**
 * MANDATORY TIERED STRUCTURE (Rule 3)
 * Tier 1 → Entry points
 * Tier 2 → Infrastructure
 * Tier 3 → Services
 * Tier 4 → Data Layer
 */
export type TierLevel = 1 | 2 | 3 | 4;

export interface ShapeConfig {
  shape: NodeShape;
  size: NodeSize;
  visualWeight: 'low' | 'normal' | 'high';
  minWidth: number;
  minHeight: number;
  maxHeight: number;
  tier: TierLevel;
  color: string;
}

/**
 * Mapped categories to Tiers and Colors as per Rules 3 & 6.
 * Colors:
 * Infrastructure → Gray (#6B7280)
 * Auth/Security  → Purple (#7C3AED)
 * Services       → Blue (#2563EB)
 * Async/Queue    → Orange (#D97706)
 * Databases      → Green (#059669)
 * Cache          → Teal (#0891B2)
 */
export const SHAPE_CONFIGS: Record<string, ShapeConfig> = {
  // Tier 1: Entry points
  'Client & Entry': { shape: 'pill', size: 'medium', visualWeight: 'normal', minWidth: 200, minHeight: 110, maxHeight: 110, tier: 1, color: '#6B7280' },
  'CDN & Edge': { shape: 'pill', size: 'medium', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 110, tier: 1, color: '#6B7280' },
  'DNS & Network': { shape: 'pill', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 110, tier: 1, color: '#6B7280' },

  // Tier 2: Infrastructure
  'API Gateway': { shape: 'pill', size: 'medium', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 110, tier: 2, color: '#6B7280' },
  'Load Balancer': { shape: 'pill', size: 'medium', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 110, tier: 2, color: '#6B7280' },
  'Infrastructure': { shape: 'rounded-square', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 2, color: '#6B7280' },

  // Tier 3: Services
  'Compute': { shape: 'rounded-square', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 3, color: '#2563EB' },
  'Serverless': { shape: 'rounded-square', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 3, color: '#2563EB' },
  'Auth & Security': { shape: 'shield', size: 'normal', visualWeight: 'high', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 3, color: '#7C3AED' },
  'Authentication': { shape: 'shield', size: 'normal', visualWeight: 'high', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 3, color: '#7C3AED' },
  'AI / ML': { shape: 'gradient-glow', size: 'normal', visualWeight: 'high', minWidth: 180, minHeight: 120, maxHeight: 150, tier: 3, color: '#2563EB' },
  'Worker': { shape: 'worker', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 110, maxHeight: 140, tier: 3, color: '#2563EB' },
  'Messaging & Events': { shape: 'queue', size: 'medium', visualWeight: 'normal', minWidth: 200, minHeight: 130, maxHeight: 160, tier: 3, color: '#D97706' },

  // Tier 4: Data Layer
  'Data Storage': { shape: 'cylinder', size: 'large', visualWeight: 'high', minWidth: 180, minHeight: 150, maxHeight: 180, tier: 4, color: '#059669' },
  'Database': { shape: 'cylinder', size: 'large', visualWeight: 'high', minWidth: 180, minHeight: 150, maxHeight: 180, tier: 4, color: '#059669' },
  'Caching': { shape: 'stack', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 120, maxHeight: 150, tier: 4, color: '#0891B2' },
  'Cache & Storage': { shape: 'stack', size: 'normal', visualWeight: 'normal', minWidth: 180, minHeight: 120, maxHeight: 150, tier: 4, color: '#0891B2' },

  // Others
  'Observability': { shape: 'minimal', size: 'small', visualWeight: 'low', minWidth: 180, minHeight: 110, maxHeight: 110, tier: 3, color: '#6B7280' },
  'External Services': { shape: 'dashed-rect', size: 'normal', visualWeight: 'low', minWidth: 180, minHeight: 110, maxHeight: 130, tier: 3, color: '#6B7280' },
};

export const DEFAULT_SHAPE_CONFIG: ShapeConfig = {
  shape: 'rounded-square',
  size: 'normal',
  visualWeight: 'normal',
  minWidth: 180,
  minHeight: 110,
  maxHeight: 140,
  tier: 3,
  color: '#2563EB',
};

export const NODE_SHAPES: Record<string, NodeShape> = Object.fromEntries(
  Object.entries(SHAPE_CONFIGS).map(([category, config]) => [category, config.shape])
);

export function getNodeShape(category: string): NodeShape {
  return SHAPE_CONFIGS[category]?.shape || DEFAULT_SHAPE_CONFIG.shape;
}

export function getShapeConfig(category: string): ShapeConfig {
  return SHAPE_CONFIGS[category] || DEFAULT_SHAPE_CONFIG;
}

export function getNodeSize(category: string): NodeSize {
  return SHAPE_CONFIGS[category]?.size || 'normal';
}

export function getVisualWeight(category: string): 'low' | 'normal' | 'high' {
  return SHAPE_CONFIGS[category]?.visualWeight || 'normal';
}

export function getTierForCategory(category: string): TierLevel {
  return SHAPE_CONFIGS[category]?.tier || DEFAULT_SHAPE_CONFIG.tier;
}
