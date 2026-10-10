/**
 * Simple Icons slugs for third-party technologies in iconRegistry.
 * Icons are loaded from jsDelivr at render time (CSP allows https: images).
 */
export const TECHNOLOGY_BRAND_SLUGS: Record<string, string> = {
  mongodb: 'mongodb',
  postgresql: 'postgresql',
  mysql: 'mysql',
  sqlite: 'sqlite',
  redis: 'redis',
  cassandra: 'apachecassandra',
  cockroachdb: 'cockroachlabs',
  supabase: 'supabase',
  planetscale: 'planetscale',
  fauna: 'fauna',
  firestore: 'firebase',
  prisma: 'prisma',
  drizzle: 'drizzle',
  typeorm: 'typeorm',
  sequelize: 'sequelize',
  auth0: 'auth0',
  clerk: 'clerk',
  nextauth: 'nextdotjs',
  'firebase-auth': 'firebase',
  'supabase-auth': 'supabase',
  elasticsearch: 'elasticsearch',
  algolia: 'algolia',
  typesense: 'typesense',
  meilisearch: 'meilisearch',
  kafka: 'apachekafka',
  rabbitmq: 'rabbitmq',
  upstash: 'upstash',
  datadog: 'datadog',
  sentry: 'sentry',
  newrelic: 'newrelic',
  grafana: 'grafana',
  prometheus: 'prometheus',
  openai: 'openai',
  anthropic: 'anthropic',
  pinecone: 'pinecone',
  weaviate: 'weaviate',
  langchain: 'langchain',
  huggingface: 'huggingface',
  docker: 'docker',
  kubernetes: 'kubernetes',
  vercel: 'vercel',
  railway: 'railway',
  render: 'render',
  flyio: 'flydotio',
  'github-actions': 'githubactions',
  stripe: 'stripe',
  nginx: 'nginx',
  cloudflare: 'cloudflare',
  terraform: 'terraform',
  pulumi: 'pulumi',
  vault: 'vault',
  consul: 'consul',
  temporal: 'temporal',
  airflow: 'apacheairflow',
  spark: 'apachespark',
  flink: 'apacheflink',
  snowflake: 'snowflake',
  databricks: 'databricks',
  neo4j: 'neo4j',
  influxdb: 'influxdb',
  memcached: 'memcached',
  etcd: 'etcd',
  nats: 'natsdotio',
  pulsar: 'apachepulsar',
  grpc: 'grpc',
  graphql: 'graphql',
  socketio: 'socketdotio',
  twilio: 'twilio',
  sendgrid: 'sendgrid',
  mailgun: 'mailgun',
  okta: 'okta',
  keycloak: 'keycloak',
  firebase: 'firebase',
  ansible: 'ansible',
  celery: 'celery',
  gcp: 'googlecloud',
  'gcp-compute-engine': 'googlecloud',
  'gcp-cloud-functions': 'googlecloud',
  'gcp-run': 'googlecloud',
  'gcp-gke': 'googlecloud',
  'gcp-storage': 'googlecloud',
  'gcp-sql': 'googlecloud',
  'gcp-firestore': 'firebase',
};

/** Map common node labels to iconRegistry technology keys (for brand logos). */
const LABEL_BRAND_HINTS: Array<{ technology: string; test: RegExp }> = [
  { technology: 'redis', test: /\bredis\b/i },
  { technology: 'postgresql', test: /\b(postgres|postgresql)\b/i },
  { technology: 'mysql', test: /\bmysql\b/i },
  { technology: 'mongodb', test: /\b(mongodb|mongo)\b/i },
  { technology: 'docker', test: /\bdocker\b/i },
  { technology: 'nginx', test: /\bnginx\b/i },
  { technology: 'vault', test: /\bvault\b/i },
  { technology: 'consul', test: /\bconsul\b/i },
  { technology: 'sentry', test: /\bsentry\b/i },
  { technology: 'neo4j', test: /\bneo4j\b/i },
  { technology: 'kafka', test: /\bkafka\b/i },
  { technology: 'rabbitmq', test: /\brabbitmq\b/i },
  { technology: 'elasticsearch', test: /\b(elasticsearch|elastic)\b/i },
  { technology: 'cassandra', test: /\bcassandra\b/i },
  { technology: 'kubernetes', test: /\b(kubernetes|k8s)\b/i },
  { technology: 'ansible', test: /\bansible\b/i },
  { technology: 'celery', test: /\bcelery\b/i },
  { technology: 'grafana', test: /\bgrafana\b/i },
  { technology: 'prometheus', test: /\bprometheus\b/i },
  { technology: 'datadog', test: /\bdatadog\b/i },
  { technology: 'supabase', test: /\bsupabase\b/i },
  { technology: 'prisma', test: /\bprisma\b/i },
];

export function inferBrandTechnologyFromLabel(label?: string): string | undefined {
  const text = label ?? '';
  const match = LABEL_BRAND_HINTS.find((hint) => hint.test.test(text));
  if (!match) return undefined;
  return getTechnologyBrandSlug(match.technology) ? match.technology : undefined;
}

export function getTechnologyBrandSlug(technology?: string): string | null {
  if (!technology) return null;
  if (TECHNOLOGY_BRAND_SLUGS[technology]) return TECHNOLOGY_BRAND_SLUGS[technology];
  // AWS/Azure service keys (e.g. aws-dynamodb) — use provider icons instead.
  return null;
}

export function technologyBrandIconUrl(slug: string, brandColor?: string): string {
  if (brandColor) {
    const hex = brandColor.replace('#', '');
    return `https://cdn.simpleicons.org/${slug}/${hex}`;
  }
  return `https://cdn.simpleicons.org/${slug}`;
}
