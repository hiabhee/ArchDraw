import type { ServiceType } from '@/lib/ai/types';

export interface NodeShapeConfig {
  width: number;
  height: number;
  variant: string;
  fillOpacity: number;
  strokeOpacity: number;
}

const DEFAULT_CONFIG: NodeShapeConfig = {
  width: 200,
  height: 88,
  variant: 'ROUNDED_SQUARE',
  fillOpacity: 0.1,
  strokeOpacity: 0.4,
};

export const NODE_SHAPE_CONFIG: Record<string, NodeShapeConfig> = {
  // Service types
  service: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  api: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  worker: { width: 180, height: 96, variant: 'FUNCTION', fillOpacity: 0.1, strokeOpacity: 0.4 },
  auth: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  gateway: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  proxy: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  function: { width: 180, height: 96, variant: 'FUNCTION', fillOpacity: 0.1, strokeOpacity: 0.4 },
  scheduler: { width: 180, height: 96, variant: 'FUNCTION', fillOpacity: 0.1, strokeOpacity: 0.4 },
  compute: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  generic: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Database types (cylinders are taller)
  database: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  postgres: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  mysql: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  mongodb: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  redis: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  cassandra: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  dynamodb: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  elasticsearch: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  neo4j: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  sqlite: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  firestore: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  supabase: { width: 200, height: 112, variant: 'CYLINDER', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Cache types (new CACHE silhouette; legacy DIAMOND kept for backward compat only)
  cache: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  memcached: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  elasticache: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Queue types (new QUEUE silhouette — message-lane horizontal shape)
  queue: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  kafka: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  rabbitmq: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  sqs: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  sns: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  pubsub: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  eventbus: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  nats: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  kinesis: { width: 240, height: 80, variant: 'QUEUE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // CDN / edge cache (new CACHE silhouette)
  cdn: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  varnish: { width: 180, height: 96, variant: 'CACHE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // AI / ML types
  ai: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Server types
  server: { width: 200, height: 88, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Container / Pod types (new CONTAINER silhouette)
  docker: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  container: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  pod: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  kubernetes: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  k8s: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },
  deployment: { width: 220, height: 104, variant: 'CONTAINER', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // External/Cloud types
  external: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  thirdparty: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  saas: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  stripe: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  twilio: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  sendgrid: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  aws: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  gcp: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  azure: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  firebase: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  vercel: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  netlify: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },
  cloudflare: { width: 240, height: 96, variant: 'CLOUD', fillOpacity: 0.08, strokeOpacity: 0.4 },

  // Load balancer types (hexagon)
  loadbalancer: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  ingress: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  traefik: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  nginx: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  haproxy: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  istio: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },
  envoy: { width: 200, height: 90, variant: 'HEXAGON', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Firewall/Security types (shield)
  firewall: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  waf: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  vault: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  keycloak: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  oauth: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  jwt: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  ssl: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  tls: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  certmanager: { width: 200, height: 96, variant: 'ROUNDED_SQUARE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Client types (monitor screen)
  client: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  browser: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  webapp: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  frontend: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  spa: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  pwa: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
  desktop: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Mobile types
  mobile: { width: 160, height: 100, variant: 'MOBILE_PHONE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  ios: { width: 160, height: 100, variant: 'MOBILE_PHONE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  android: { width: 160, height: 100, variant: 'MOBILE_PHONE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  reactnative: { width: 160, height: 100, variant: 'MOBILE_PHONE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  flutter: { width: 160, height: 100, variant: 'MOBILE_PHONE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // User types
  user: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  actor: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  person: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  customer: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  admin: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  operator: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },
  developer: { width: 160, height: 88, variant: 'USER_CIRCLE', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Background job types (function silhouette for lambdas/workers; gear fallback stays)
  backgroundjob: { width: 160, height: 88, variant: 'GEAR', fillOpacity: 0.1, strokeOpacity: 0.4 },
  cronjob: { width: 180, height: 96, variant: 'FUNCTION', fillOpacity: 0.1, strokeOpacity: 0.4 },
  processor: { width: 160, height: 88, variant: 'GEAR', fillOpacity: 0.1, strokeOpacity: 0.4 },
  consumer: { width: 160, height: 88, variant: 'GEAR', fillOpacity: 0.1, strokeOpacity: 0.4 },
  daemon: { width: 160, height: 88, variant: 'GEAR', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Monitoring types (chart)
  monitoring: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  observability: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  logging: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  metrics: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  prometheus: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  grafana: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  datadog: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  sentry: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  opentelemetry: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  jaeger: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },
  zipkin: { width: 200, height: 96, variant: 'CHART', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Object / blob storage (new BUCKET silhouette)
  storage: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },
  s3: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },
  gcs: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },
  blob: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },
  azureblob: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },
  minio: { width: 180, height: 104, variant: 'BUCKET', fillOpacity: 0.1, strokeOpacity: 0.4 },

  // Monitor types
  monitor: { width: 200, height: 100, variant: 'MONITOR_SCREEN', fillOpacity: 0.1, strokeOpacity: 0.4 },
};

export function getNodeShapeConfig(serviceType?: string): NodeShapeConfig {
  if (!serviceType) return DEFAULT_CONFIG;
  return NODE_SHAPE_CONFIG[serviceType.toLowerCase()] || DEFAULT_CONFIG;
}

export function getNodeWidth(serviceType?: string): number {
  return getNodeShapeConfig(serviceType).width;
}

export function getNodeHeight(serviceType?: string): number {
  return getNodeShapeConfig(serviceType).height;
}
