/**
 * Mode-specific icon filtering for sketch vs precision rendering.
 * 
 * In sketch mode: prefer internal arch-* glyphs to match hand-drawn style
 * In precision mode: allow brand/provider icons when they add recognition
 */

export type RenderStyleId = 'sketch' | 'precision';

/**
 * Technology brands that should be replaced with role-appropriate glyphs in sketch mode.
 * These technologies have recognizable brand logos but their role is more important in diagrams.
 */
const SKETCH_MODE_BRAND_TO_GLYPH: Record<string, string> = {
  // Databases - show database type, not brand
  'mongodb': 'arch-document-db',
  'postgresql': 'arch-database',
  'mysql': 'arch-database',
  'sqlite': 'arch-database',
  'redis': 'arch-cache',
  'cassandra': 'arch-key-value',
  'cockroachdb': 'arch-database',
  'supabase': 'arch-database',
  'planetscale': 'arch-database',
  'fauna': 'arch-document-db',
  'firestore': 'arch-document-db',
  'neo4j': 'arch-database',
  'influxdb': 'arch-timeseries',
  
  // Messaging - show queue/stream, not brand
  'kafka': 'arch-event-stream',
  'rabbitmq': 'arch-message-queue',
  'upstash': 'arch-cache',
  'nats': 'arch-message-queue',
  'pulsar': 'arch-event-stream',
  
  // Infrastructure - show role, not brand
  'docker': 'arch-docker',
  'kubernetes': 'arch-kubernetes',
  'nginx': 'arch-proxy',
  'vault': 'arch-secrets',
  'consul': 'arch-coordinator',
  'etcd': 'arch-key-value',
  
  // Search - show search icon, not brand
  'elasticsearch': 'arch-search',
  'algolia': 'arch-search',
  'typesense': 'arch-search',
  'meilisearch': 'arch-search',
  
  // Monitoring - show observability role, not brand
  'datadog': 'arch-observability',
  'sentry': 'arch-logs',
  'newrelic': 'arch-metrics',
  'grafana': 'arch-metrics',
  'prometheus': 'arch-metrics',
  
  // ORMs - show database connection, not brand
  'prisma': 'arch-database',
  'drizzle': 'arch-database',
  'typeorm': 'arch-database',
  'sequelize': 'arch-database',
  
  // Auth - show auth role, not brand
  'auth0': 'arch-auth',
  'clerk': 'arch-users',
  'nextauth': 'arch-auth',
  'okta': 'arch-auth',
  'keycloak': 'arch-auth',
  
  // AI - show AI role, not brand
  'openai': 'arch-ai',
  'anthropic': 'arch-ai',
  'pinecone': 'arch-vector',
  'weaviate': 'arch-vector',
  'langchain': 'arch-agent',
  'huggingface': 'arch-ai',
  
  // Cloud platforms - show compute/service, not brand
  'vercel': 'arch-web',
  'railway': 'arch-server',
  'render': 'arch-server',
  'flyio': 'arch-cdn',
  
  // Integration - show role, not brand
  'stripe': 'arch-payment',
  'twilio': 'arch-notification',
  'sendgrid': 'arch-email',
  'mailgun': 'arch-email',
  
  // Workflow - show orchestration, not brand
  'temporal': 'arch-workflow',
  'airflow': 'arch-workflow',
  'spark': 'arch-stream-processor',
  'flink': 'arch-stream-processor',
  
  // Infrastructure as Code - show config, not brand
  'terraform': 'arch-config',
  'pulumi': 'arch-config',
  'ansible': 'arch-config',
  
  // Data warehouses - show warehouse, not brand
  'snowflake': 'arch-warehouse',
  'databricks': 'arch-warehouse',
  
  // Protocols - show protocol role, not brand
  'grpc': 'arch-grpc',
  'graphql': 'arch-graphql',
  'socketio': 'arch-realtime',
  
  // CI/CD - show pipeline, not brand
  'github-actions': 'arch-cicd',
  
  // Cloud providers (GCP) - show role, not brand
  'gcp': 'arch-external',
  'gcp-compute-engine': 'arch-server',
  'gcp-cloud-functions': 'arch-function',
  'gcp-run': 'arch-service',
  'gcp-gke': 'arch-kubernetes',
  'gcp-storage': 'arch-storage',
  'gcp-sql': 'arch-database',
  'gcp-firestore': 'arch-document-db',
  
  // Queue runners
  'celery': 'arch-worker',
};

/**
 * Check if an icon should use a brand logo or be replaced with a role glyph.
 * 
 * @param iconName - The resolved icon name (could be tech slug, arch-*, aws-*, etc.)
 * @param technology - The technology identifier
 * @param renderStyle - Current render style (sketch or precision)
 * @returns The icon name to actually render (may be different in sketch mode)
 */
export function filterIconForMode(
  iconName: string,
  technology: string | undefined,
  renderStyle: RenderStyleId
): string {
  // Precision mode: allow all icons as-is
  if (renderStyle === 'precision') {
    return iconName;
  }
  
  // Sketch mode: prefer internal glyphs over brand logos
  
  // Already an arch-* glyph: keep it
  if (iconName.startsWith('arch-')) {
    return iconName;
  }
  
  // AWS/Azure provider icons: keep them (they're already role-appropriate SVG glyphs)
  if (iconName.startsWith('aws-') || iconName.startsWith('azure-')) {
    return iconName;
  }
  
  // Technology brands: replace with role-appropriate glyph in sketch mode
  if (technology && SKETCH_MODE_BRAND_TO_GLYPH[technology]) {
    return SKETCH_MODE_BRAND_TO_GLYPH[technology];
  }
  
  // If iconName is itself a technology slug (e.g., 'mongodb', 'redis'), replace it
  if (SKETCH_MODE_BRAND_TO_GLYPH[iconName]) {
    return SKETCH_MODE_BRAND_TO_GLYPH[iconName];
  }
  
  // Lucide icons: keep them (they're generic enough)
  // Simple Icons brand logos that aren't in our mapping: keep them in sketch mode
  // (This handles edge cases where a brand is actually useful for recognition)
  
  return iconName;
}

/**
 * Check if a technology should bypass brand logo rendering in sketch mode.
 * Used by TechnologyBrandIcon component to determine whether to render.
 */
export function shouldUseBrandLogoInMode(
  technology: string,
  renderStyle: RenderStyleId
): boolean {
  if (renderStyle === 'precision') {
    return true;
  }
  
  // In sketch mode, only use brand logos for technologies NOT in our replacement map
  return !SKETCH_MODE_BRAND_TO_GLYPH[technology];
}

/**
 * Get the role-appropriate glyph for a technology (used when brand is suppressed).
 */
export function getRoleGlyphForTechnology(technology: string): string | null {
  return SKETCH_MODE_BRAND_TO_GLYPH[technology] || null;
}
