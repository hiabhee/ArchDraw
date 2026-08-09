/**
 * Single source of truth for canvas silhouettes (ShapeNode + Mermaid + factory).
 *
 * Phase 0 / 1 of the visual-vocabulary plan: semantic silhouettes (hexagon,
 * cloud, shield, actor, monitor, mobile, dashed-rectangle) get the same
 * recognition power as the original shape family. This module maps
 * `nodeShapeConfig` variants → canvas `ShapeType` and service types → shapes,
 * so editor, AI pipeline, and Mermaid round-trip agree.
 */

import { NODE_SHAPE_CONFIG } from '@/constants/nodeShapeConfig';

/** Canonical canvas silhouette set — shared by ShapeNode, store, and Mermaid. */
export type ShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'diamond'
  | 'cylinder'
  | 'circle'
  | 'parallelogram'
  | 'hexagon'
  | 'cloud'
  | 'shield'
  | 'actor'
  | 'monitor'
  | 'mobile'
  | 'dashed-rectangle';

/** nodeShapeConfig `variant` → canvas `ShapeType`. */
export const VARIANT_TO_SHAPE: Record<string, ShapeType> = {
  ROUNDED_SQUARE: 'rounded-rectangle',
  CYLINDER: 'cylinder',
  DIAMOND: 'diamond',
  PILL_HORIZONTAL: 'cylinder',
  CLOUD: 'cloud',
  HEXAGON: 'hexagon',
  SHIELD: 'shield',
  MONITOR_SCREEN: 'monitor',
  MOBILE_PHONE: 'mobile',
  USER_CIRCLE: 'actor',
  GEAR: 'rounded-rectangle',
  CHART: 'rounded-rectangle',
};

/** Canonical shape set the system can render (variant-derived + directive-only silhouettes). */
export const SUPPORTED_SHAPES: ShapeType[] = [
  ...new Set<ShapeType>([...Object.values(VARIANT_TO_SHAPE), 'dashed-rectangle']),
];

/** True when a shape is only expressible via `%% archdraw-shape` directives. */
export const NATIVE_MERMAID_SHAPES: ReadonlySet<ShapeType> = new Set<ShapeType>([
  'rectangle',
  'rounded-rectangle',
  'diamond',
  'cylinder',
  'circle',
  'parallelogram',
  'hexagon',
]);

/** True when the shape needs the `%% archdraw-shape` directive on round-trip. */
export function isDirectiveOnlyShape(shape: string | undefined | null): boolean {
  if (!shape) return false;
  return !NATIVE_MERMAID_SHAPES.has(shape as ShapeType);
}

/** Resolve the shape for a `nodeShapeConfig` variant key (falls back to rounded). */
export function shapeFromVariant(variant: string | undefined): ShapeType {
  if (!variant) return 'rounded-rectangle';
  return VARIANT_TO_SHAPE[variant] ?? 'rounded-rectangle';
}

/** Resolve the shape declared by a `NODE_SHAPE_CONFIG` entry (by service type key). */
export function shapeFromServiceConfigKey(key: string): ShapeType {
  const config = NODE_SHAPE_CONFIG[key];
  return shapeFromVariant(config?.variant);
}

const SERVICE_TYPE_TO_SHAPE: Record<string, ShapeType> = {
  // Data
  database: 'cylinder',
  cache: 'cylinder',
  storage: 'cylinder',
  // Queues — horizontal pipe
  queue: 'cylinder',
  // Ingress / LB
  'load-balancer': 'hexagon',
  loadbalancer: 'hexagon',
  ingress: 'hexagon',
  nginx: 'hexagon',
  gateway: 'hexagon',
  proxy: 'hexagon',
  // External / SaaS / cloud providers
  'external-service': 'cloud',
  external: 'cloud',
  saas: 'cloud',
  thirdparty: 'cloud',
  aws: 'cloud',
  gcp: 'cloud',
  azure: 'cloud',
  // Security
  firewall: 'shield',
  waf: 'shield',
  vault: 'shield',
  oauth: 'shield',
  auth: 'shield',
  jwt: 'shield',
  tls: 'shield',
  ssl: 'shield',
  keycloak: 'shield',
  // Clients
  client: 'monitor',
  browser: 'monitor',
  webapp: 'monitor',
  frontend: 'monitor',
  spa: 'monitor',
  pwa: 'monitor',
  desktop: 'monitor',
  monitor: 'monitor',
  // Mobile
  mobile: 'mobile',
  ios: 'mobile',
  android: 'mobile',
  // Users / actors
  user: 'actor',
  actor: 'actor',
  person: 'actor',
  customer: 'actor',
  admin: 'actor',
  operator: 'actor',
  developer: 'actor',
};

/** Map a `serviceType` to a canvas silhouette (matches editor + Mermaid build). */
export function shapeForServiceType(serviceType?: string): ShapeType {
  if (!serviceType) return 'rounded-rectangle';
  return SERVICE_TYPE_TO_SHAPE[serviceType] ?? 'rounded-rectangle';
}
