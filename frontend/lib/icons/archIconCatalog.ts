/**
 * Catalog of custom architecture node icons for picker UI and type safety.
 */

export type ArchIconCategory =
  | 'client'
  | 'network'
  | 'compute'
  | 'data'
  | 'messaging'
  | 'security'
  | 'observability'
  | 'ai'
  | 'integration'
  | 'patterns';

export type ArchIconEntry = {
  id: string;
  label: string;
  category: ArchIconCategory;
};

export const ARCH_ICON_CATALOG: ArchIconEntry[] = [
  // Client
  { id: 'arch-web', label: 'Web', category: 'client' },
  { id: 'arch-mobile', label: 'Mobile', category: 'client' },
  { id: 'arch-desktop', label: 'Desktop', category: 'client' },
  { id: 'arch-terminal', label: 'Terminal / CLI', category: 'client' },
  { id: 'arch-users', label: 'Users', category: 'client' },

  // Network & edge
  { id: 'arch-api-gateway', label: 'API Gateway', category: 'network' },
  { id: 'arch-grpc', label: 'gRPC', category: 'network' },
  { id: 'arch-load-balancer', label: 'Load Balancer', category: 'network' },
  { id: 'arch-proxy', label: 'Reverse Proxy', category: 'network' },
  { id: 'arch-router', label: 'Router', category: 'network' },
  { id: 'arch-cdn', label: 'CDN', category: 'network' },
  { id: 'arch-dns', label: 'DNS', category: 'network' },
  { id: 'arch-graphql', label: 'GraphQL', category: 'network' },
  { id: 'arch-webhook', label: 'Webhook', category: 'network' },
  { id: 'arch-realtime', label: 'WebSocket', category: 'network' },
  { id: 'arch-external', label: 'External API', category: 'network' },

  // Compute
  { id: 'arch-server', label: 'Server', category: 'compute' },
  { id: 'arch-service', label: 'Microservice', category: 'compute' },
  { id: 'arch-function', label: 'Serverless', category: 'compute' },
  { id: 'arch-worker', label: 'Worker', category: 'compute' },
  { id: 'arch-scheduler', label: 'Scheduler', category: 'compute' },
  { id: 'arch-batch', label: 'Batch Job', category: 'compute' },
  { id: 'arch-docker', label: 'Container', category: 'compute' },
  { id: 'arch-kubernetes', label: 'Kubernetes', category: 'compute' },
  { id: 'arch-cluster', label: 'Cluster', category: 'compute' },
  { id: 'arch-vm', label: 'Virtual Machine', category: 'compute' },
  { id: 'arch-upload', label: 'Upload', category: 'compute' },
  { id: 'arch-download', label: 'Download', category: 'compute' },

  // Data
  { id: 'arch-database', label: 'SQL Database', category: 'data' },
  { id: 'arch-document-db', label: 'Document DB', category: 'data' },
  { id: 'arch-key-value', label: 'Key-Value Store', category: 'data' },
  { id: 'arch-timeseries', label: 'Time Series', category: 'data' },
  { id: 'arch-cache', label: 'Cache', category: 'data' },
  { id: 'arch-storage', label: 'Object Storage', category: 'data' },
  { id: 'arch-file', label: 'File System', category: 'data' },
  { id: 'arch-warehouse', label: 'Data Warehouse', category: 'data' },
  { id: 'arch-search', label: 'Search Engine', category: 'data' },
  { id: 'arch-vector', label: 'Vector DB', category: 'data' },
  { id: 'arch-replication', label: 'Replication', category: 'data' },
  { id: 'arch-backup', label: 'Backup', category: 'data' },
  { id: 'arch-etl', label: 'ETL / Pipeline', category: 'data' },

  // Messaging
  { id: 'arch-message-queue', label: 'Message Queue', category: 'messaging' },
  { id: 'arch-event-stream', label: 'Event Stream', category: 'messaging' },
  { id: 'arch-stream-processor', label: 'Stream Processor', category: 'messaging' },
  { id: 'arch-producer', label: 'Producer', category: 'messaging' },
  { id: 'arch-consumer', label: 'Consumer', category: 'messaging' },
  { id: 'arch-consumer-group', label: 'Consumer Group', category: 'messaging' },
  { id: 'arch-broker', label: 'Broker', category: 'messaging' },
  { id: 'arch-topic', label: 'Topic', category: 'messaging' },
  { id: 'arch-partition', label: 'Partition', category: 'messaging' },
  { id: 'arch-coordinator', label: 'Coordinator', category: 'messaging' },
  { id: 'arch-dead-letter', label: 'Dead Letter Queue', category: 'messaging' },

  // Security & auth
  { id: 'arch-auth', label: 'Authentication', category: 'security' },
  { id: 'arch-sso', label: 'SSO', category: 'security' },
  { id: 'arch-secrets', label: 'Secrets', category: 'security' },
  { id: 'arch-firewall', label: 'Firewall / WAF', category: 'security' },

  // Observability
  { id: 'arch-observability', label: 'Observability', category: 'observability' },
  { id: 'arch-metrics', label: 'Metrics', category: 'observability' },
  { id: 'arch-logs', label: 'Logs', category: 'observability' },
  { id: 'arch-trace', label: 'Tracing', category: 'observability' },
  { id: 'arch-health-check', label: 'Health Check', category: 'observability' },
  { id: 'arch-notification', label: 'Notifications', category: 'observability' },

  // AI
  { id: 'arch-ai', label: 'AI / LLM', category: 'ai' },
  { id: 'arch-agent', label: 'AI Agent', category: 'ai' },
  { id: 'arch-knowledge', label: 'Knowledge Base', category: 'ai' },

  // Integration & patterns
  { id: 'arch-cicd', label: 'CI/CD', category: 'integration' },
  { id: 'arch-registry', label: 'Registry', category: 'integration' },
  { id: 'arch-config', label: 'Config', category: 'integration' },
  { id: 'arch-payment', label: 'Payments', category: 'integration' },
  { id: 'arch-email', label: 'Email', category: 'integration' },
  { id: 'arch-chat', label: 'Chat', category: 'integration' },
  { id: 'arch-maps', label: 'Maps / Geo', category: 'integration' },
  { id: 'arch-workflow', label: 'Workflow', category: 'integration' },
  { id: 'arch-circuit-breaker', label: 'Circuit Breaker', category: 'patterns' },
];

export type CustomNodeIconName = (typeof ARCH_ICON_CATALOG)[number]['id'];

export const ARCH_ICON_IDS = ARCH_ICON_CATALOG.map((entry) => entry.id);

export const CUSTOM_ICON_SET = new Set<string>(ARCH_ICON_IDS);

export const ARCH_ICON_CATEGORY_LABELS: Record<ArchIconCategory, string> = {
  client: 'Client',
  network: 'Network',
  compute: 'Compute',
  data: 'Data',
  messaging: 'Messaging',
  security: 'Security',
  observability: 'Observability',
  ai: 'AI',
  integration: 'Integration',
  patterns: 'Patterns',
};

export function getArchIconsByCategory(): Record<ArchIconCategory, ArchIconEntry[]> {
  const grouped = {} as Record<ArchIconCategory, ArchIconEntry[]>;
  for (const entry of ARCH_ICON_CATALOG) {
    grouped[entry.category] ??= [];
    grouped[entry.category].push(entry);
  }
  return grouped;
}
