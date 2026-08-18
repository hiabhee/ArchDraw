/**
 * Single source of truth for canvas silhouettes (ShapeNode + Mermaid + factory).
 *
 * Phase 0 / 1 of the visual-vocabulary plan: semantic silhouettes (hexagon,
 * cloud, shield, actor, monitor, mobile, dashed-rectangle) get the same
 * recognition power as the original shape family. This module maps
 * `nodeShapeConfig` variants → canvas `ShapeType` and service types → shapes,
 * so editor, AI pipeline, and Mermaid round-trip agree.
 *
 * Phase 1 extension: five architecture-native custom silhouettes added:
 * queue, cache, function, container, bucket.
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
  | 'actor'
  | 'monitor'
  | 'mobile'
  | 'dashed-rectangle'
  // Architecture-native semantic silhouettes (Phase 1)
  | 'queue'
  | 'cache'
  | 'function'
  | 'container'
  | 'bucket'
  | 'document'
  | 'documents';

/** nodeShapeConfig `variant` → canvas `ShapeType`. */
export const VARIANT_TO_SHAPE: Record<string, ShapeType> = {
  ROUNDED_SQUARE: 'rounded-rectangle',
  CYLINDER: 'cylinder',
  DIAMOND: 'diamond',
  PILL_HORIZONTAL: 'cylinder',
  CLOUD: 'cloud',
  HEXAGON: 'hexagon',
  MONITOR_SCREEN: 'monitor',
  MOBILE_PHONE: 'mobile',
  USER_CIRCLE: 'actor',
  GEAR: 'rounded-rectangle',
  CHART: 'rounded-rectangle',
  // New architecture-native variants
  QUEUE: 'queue',
  CACHE: 'cache',
  FUNCTION: 'function',
  CONTAINER: 'container',
  BUCKET: 'bucket',
  DOCUMENT: 'document',
  DOCUMENTS: 'documents',
};

/** Canonical shape set the system can render (variant-derived + directive-only silhouettes). */
export const SUPPORTED_SHAPES: ShapeType[] = [
  ...new Set<ShapeType>([
    ...Object.values(VARIANT_TO_SHAPE),
    'dashed-rectangle',
    'queue',
    'cache',
    'function',
    'container',
    'bucket',
    'document',
    'documents',
  ]),
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
  // Data - use cylinder for vertical database drums
  database: 'cylinder',
  // Queues / Async Streams - use dedicated 'queue' shape (not cylinder!)
  queue: 'queue',
  kafka: 'queue',
  rabbitmq: 'queue',
  sqs: 'queue',
  sns: 'queue',
  pubsub: 'queue',
  eventbus: 'queue',
  nats: 'queue',
  kinesis: 'queue',
  'message-queue': 'queue',
  messagequeue: 'queue',
  // Cache / Memory Stores (new: 'cache' silhouette)
  cache: 'cache',
  redis: 'cache',
  memcached: 'cache',
  elasticache: 'cache',
  cdn: 'cache',
  varnish: 'cache',
  // Serverless Functions (new: 'function' silhouette)
  function: 'function',
  lambda: 'function',
  cloudfunction: 'function',
  cloudfunctions: 'function',
  edgeworker: 'function',
  worker: 'function',
  scheduler: 'function',
  cronjob: 'function',
  // Container / Pod (new: 'container' silhouette)
  docker: 'container',
  container: 'container',
  pod: 'container',
  kubernetes: 'container',
  k8s: 'container',
  deployment: 'container',
  // Object / Blob Storage (new: 'bucket' silhouette)
  storage: 'bucket',
  objectstorage: 'bucket',
  'object-storage': 'bucket',
  s3: 'bucket',
  gcs: 'bucket',
  blob: 'bucket',
  azureblob: 'bucket',
  minio: 'bucket',
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
  // Security — falls back to default rounded-rectangle
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
