export interface StrictPortConfig {
  inputs: number;
  outputs: number;
  label?: string;
  description?: string;
}

export type ComponentPortKey = string;

export const COMPONENT_PORTS: Record<ComponentPortKey, StrictPortConfig> = {
  // ==================== CLIENT ====================
  client_web: { inputs: 0, outputs: 1, label: 'Web Client' },
  client_mobile: { inputs: 0, outputs: 1, label: 'Mobile Client' },
  client_desktop: { inputs: 0, outputs: 1, label: 'Desktop Client' },
  browser: { inputs: 0, outputs: 1, label: 'Browser' },
  spa: { inputs: 0, outputs: 1, label: 'Single Page App' },

  // ==================== ENTRY / ROUTERS ====================
  dns: { inputs: 1, outputs: 1, label: 'DNS' },
  cdn: { inputs: 1, outputs: 3, label: 'CDN' },
  api_gateway: { inputs: 1, outputs: 4, label: 'API Gateway' },
  load_balancer: { inputs: 1, outputs: 4, label: 'Load Balancer' },
  reverse_proxy: { inputs: 1, outputs: 3, label: 'Reverse Proxy' },
  bff_gateway: { inputs: 1, outputs: 3, label: 'BFF Gateway' },
  edge_function: { inputs: 1, outputs: 2, label: 'Edge Function' },
  ingress: { inputs: 1, outputs: 3, label: 'Ingress' },

  // ==================== COMPUTE ====================
  server_monolith: { inputs: 3, outputs: 3, label: 'Monolith Server' },
  microservice: { inputs: 3, outputs: 3, label: 'Microservice' },
  serverless_fn: { inputs: 2, outputs: 2, label: 'Serverless Function' },
  aws_lambda: { inputs: 2, outputs: 2, label: 'AWS Lambda' },
  azure_function: { inputs: 2, outputs: 2, label: 'Azure Function' },
  cloud_function: { inputs: 2, outputs: 2, label: 'Cloud Function' },
  upload_service: { inputs: 2, outputs: 2, label: 'Upload Service' },
  user_service: { inputs: 3, outputs: 3, label: 'User Service' },
  chat_service: { inputs: 3, outputs: 3, label: 'Chat Service' },
  worker_job: { inputs: 1, outputs: 1, label: 'Background Worker' },
  cron_job: { inputs: 1, outputs: 1, label: 'Cron Job' },
  container: { inputs: 3, outputs: 3, label: 'Container' },
  kubernetes_pod: { inputs: 3, outputs: 3, label: 'K8s Pod' },
  ecs_task: { inputs: 3, outputs: 3, label: 'ECS Task' },
  vm: { inputs: 3, outputs: 3, label: 'Virtual Machine' },
  ec2: { inputs: 3, outputs: 3, label: 'EC2 Instance' },

  // ==================== DATA STORAGE ====================
  sql_db: { inputs: 3, outputs: 0, label: 'SQL Database' },
  postgresql: { inputs: 3, outputs: 0, label: 'PostgreSQL' },
  mysql: { inputs: 3, outputs: 0, label: 'MySQL' },
  mariadb: { inputs: 3, outputs: 0, label: 'MariaDB' },
  nosql_db: { inputs: 3, outputs: 0, label: 'NoSQL Database' },
  mongodb: { inputs: 3, outputs: 0, label: 'MongoDB' },
  dynamodb: { inputs: 3, outputs: 0, label: 'DynamoDB' },
  cassandra: { inputs: 3, outputs: 0, label: 'Cassandra' },
  firestore: { inputs: 3, outputs: 0, label: 'Firestore' },
  object_storage: { inputs: 3, outputs: 0, label: 'Object Storage' },
  s3: { inputs: 3, outputs: 0, label: 'S3 Bucket' },
  blob_storage: { inputs: 3, outputs: 0, label: 'Blob Storage' },
  file_system: { inputs: 3, outputs: 0, label: 'File System' },
  search_engine: { inputs: 3, outputs: 1, label: 'Search Engine' },
  elasticsearch: { inputs: 3, outputs: 1, label: 'Elasticsearch' },
  algolia: { inputs: 3, outputs: 1, label: 'Algolia' },
  data_warehouse: { inputs: 3, outputs: 0, label: 'Data Warehouse' },
  bigquery: { inputs: 3, outputs: 0, label: 'BigQuery' },
  redshift: { inputs: 3, outputs: 0, label: 'Redshift' },
  timeseries_db: { inputs: 3, outputs: 0, label: 'Time Series DB' },
  influxdb: { inputs: 3, outputs: 0, label: 'InfluxDB' },
  grafana: { inputs: 3, outputs: 0, label: 'Grafana DB' },

  // ==================== CACHE ====================
  in_memory_cache: { inputs: 2, outputs: 2, label: 'In-Memory Cache' },
  redis: { inputs: 2, outputs: 2, label: 'Redis' },
  memcached: { inputs: 2, outputs: 2, label: 'Memcached' },
  cdn_cache: { inputs: 1, outputs: 2, label: 'CDN Cache' },
  app_cache: { inputs: 2, outputs: 2, label: 'Application Cache' },
  varnish: { inputs: 1, outputs: 2, label: 'Varnish Cache' },
  cloudfront: { inputs: 1, outputs: 2, label: 'CloudFront' },

  // ==================== MESSAGING ====================
  message_queue: { inputs: 3, outputs: 3, label: 'Message Queue' },
  rabbitmq: { inputs: 3, outputs: 3, label: 'RabbitMQ' },
  aws_sqs: { inputs: 3, outputs: 3, label: 'AWS SQS' },
  event_bus: { inputs: 2, outputs: 3, label: 'Event Bus' },
  kafka_streaming: { inputs: 3, outputs: 3, label: 'Kafka' },
  pubsub: { inputs: 2, outputs: 3, label: 'Pub/Sub' },
  google_pubsub: { inputs: 2, outputs: 3, label: 'Google Pub/Sub' },
  aws_sns: { inputs: 2, outputs: 3, label: 'AWS SNS' },
  webhook: { inputs: 1, outputs: 1, label: 'Webhook' },
  sqs_queue: { inputs: 3, outputs: 3, label: 'SQS Queue' },

  // ==================== AUTH ====================
  auth_service: { inputs: 3, outputs: 1, label: 'Auth Service' },
  oauth_provider: { inputs: 1, outputs: 1, label: 'OAuth Provider' },
  cognito: { inputs: 1, outputs: 1, label: 'Cognito' },
  auth0: { inputs: 1, outputs: 1, label: 'Auth0' },
  api_key_manager: { inputs: 2, outputs: 1, label: 'API Key Manager' },
  firewall_waf: { inputs: 1, outputs: 1, label: 'WAF / Firewall' },
  vpn_gateway: { inputs: 1, outputs: 1, label: 'VPN Gateway' },

  // ==================== OBSERVABILITY ====================
  logger: { inputs: 3, outputs: 0, label: 'Logger' },
  log_service: { inputs: 3, outputs: 0, label: 'Log Service' },
  cloudwatch: { inputs: 3, outputs: 0, label: 'CloudWatch' },
  datadog: { inputs: 3, outputs: 0, label: 'Datadog' },
  metrics_collector: { inputs: 3, outputs: 0, label: 'Metrics Collector' },
  prometheus: { inputs: 3, outputs: 0, label: 'Prometheus' },
  tracing_service: { inputs: 3, outputs: 0, label: 'Tracing Service' },
  jaeger: { inputs: 3, outputs: 0, label: 'Jaeger' },
  zipkin: { inputs: 3, outputs: 0, label: 'Zipkin' },
  dashboard: { inputs: 3, outputs: 0, label: 'Dashboard' },
  grafana_dashboard: { inputs: 3, outputs: 0, label: 'Grafana' },
  sentry: { inputs: 3, outputs: 0, label: 'Sentry' },

  // ==================== AI / ML ====================
  llm_api: { inputs: 3, outputs: 1, label: 'LLM API' },
  openai: { inputs: 3, outputs: 1, label: 'OpenAI' },
  anthropic: { inputs: 3, outputs: 1, label: 'Anthropic' },
  vector_db: { inputs: 3, outputs: 0, label: 'Vector Database' },
  pinecone: { inputs: 3, outputs: 0, label: 'Pinecone' },
  weaviate: { inputs: 3, outputs: 0, label: 'Weaviate' },
  embedding_service: { inputs: 2, outputs: 1, label: 'Embedding Service' },
  rag_pipeline: { inputs: 3, outputs: 1, label: 'RAG Pipeline' },
  ml_model: { inputs: 2, outputs: 1, label: 'ML Model' },
  sagemaker: { inputs: 2, outputs: 1, label: 'SageMaker' },

  // ==================== EXTERNAL SERVICES ====================
  email_service: { inputs: 1, outputs: 0, label: 'Email Service' },
  sendgrid: { inputs: 1, outputs: 0, label: 'SendGrid' },
  ses: { inputs: 1, outputs: 0, label: 'AWS SES' },
  resend: { inputs: 1, outputs: 0, label: 'Resend' },
  payment_gateway: { inputs: 1, outputs: 1, label: 'Payment Gateway' },
  stripe: { inputs: 1, outputs: 1, label: 'Stripe' },
  paypal: { inputs: 1, outputs: 1, label: 'PayPal' },
  sms_push: { inputs: 1, outputs: 0, label: 'SMS Service' },
  twilio: { inputs: 1, outputs: 0, label: 'Twilio' },
  push_notification: { inputs: 1, outputs: 0, label: 'Push Notifications' },
  fcm: { inputs: 1, outputs: 0, label: 'FCM' },
  third_party_api: { inputs: 1, outputs: 1, label: 'Third Party API' },
  stripe_api: { inputs: 1, outputs: 1, label: 'Stripe API' },

  // ==================== DEVOPS / INFRA ====================
  cicd_pipeline: { inputs: 1, outputs: 3, label: 'CI/CD Pipeline' },
  github_actions: { inputs: 1, outputs: 3, label: 'GitHub Actions' },
  jenkins: { inputs: 1, outputs: 3, label: 'Jenkins' },
  container_registry: { inputs: 2, outputs: 1, label: 'Container Registry' },
  ecr: { inputs: 2, outputs: 1, label: 'ECR' },
  docker_hub: { inputs: 2, outputs: 1, label: 'Docker Hub' },
  secret_manager: { inputs: 2, outputs: 2, label: 'Secret Manager' },
  aws_secrets: { inputs: 2, outputs: 2, label: 'AWS Secrets' },
  vault: { inputs: 2, outputs: 2, label: 'HashiCorp Vault' },
  config_service: { inputs: 2, outputs: 2, label: 'Config Service' },
  consul: { inputs: 2, outputs: 2, label: 'Consul' },

  // ==================== REAL-TIME ====================
  websocket_server: { inputs: 2, outputs: 2, label: 'WebSocket Server' },
  socket_io: { inputs: 2, outputs: 2, label: 'Socket.io' },
  pusher: { inputs: 2, outputs: 2, label: 'Pusher' },
  realtime_db: { inputs: 2, outputs: 2, label: 'Realtime DB' },
  firebase: { inputs: 2, outputs: 2, label: 'Firebase' },
  supabase: { inputs: 2, outputs: 2, label: 'Supabase' },
};

// ==================== VALIDATION RULES ====================

type ConnectionRule = 'allow' | 'deny';

interface StrictConnectionRule {
  from: string;
  to: string;
  rule: ConnectionRule;
  reason: string;
}

export const STRICT_CONNECTION_RULES: StrictConnectionRule[] = [
  // Database rules
  { from: 'sql_db', to: 'client_web', rule: 'deny', reason: 'Database cannot directly serve clients' },
  { from: 'sql_db', to: 'client_mobile', rule: 'deny', reason: 'Database cannot directly serve clients' },
  { from: 'nosql_db', to: 'client_web', rule: 'deny', reason: 'Database cannot directly serve clients' },
  { from: 'object_storage', to: 'client_web', rule: 'deny', reason: 'Storage should go through CDN/API' },
  
  // Worker rules
  { from: 'worker_job', to: 'client_web', rule: 'deny', reason: 'Workers cannot directly output to clients' },
  { from: 'cron_job', to: 'client_web', rule: 'deny', reason: 'Cron jobs cannot output to clients' },
  
  // Observability should not drive logic
  { from: 'logger', to: 'microservice', rule: 'deny', reason: 'Logger is passive, cannot trigger services' },
  { from: 'metrics_collector', to: 'microservice', rule: 'deny', reason: 'Metrics collector is passive' },
  
  // Cache cannot be primary data source
  { from: 'in_memory_cache', to: 'sql_db', rule: 'deny', reason: 'Cache should not write to database directly' },
  
  // External should not push to clients
  { from: 'email_service', to: 'client_web', rule: 'deny', reason: 'Email service cannot directly reach client' },
  { from: 'sms_push', to: 'client_web', rule: 'deny', reason: 'SMS cannot reach client directly' },
];

// ==================== VALIDATION HELPERS ====================

export function getStrictPortConfig(componentType: string): StrictPortConfig {
  const config = COMPONENT_PORTS[componentType];
  if (!config) {
    throw new Error(`INVALID COMPONENT TYPE: "${componentType}" - No port configuration found`);
  }
  return config;
}

export function validateStrictConnection(sourceType: string, targetType: string): { allowed: boolean; reason?: string } {
  // Check for explicit deny rules
  const denyRule = STRICT_CONNECTION_RULES.find(
    r => r.from === sourceType && r.to === targetType && r.rule === 'deny'
  );
  
  if (denyRule) {
    return { allowed: false, reason: denyRule.reason };
  }
  
  // Allow if not explicitly denied
  return { allowed: true };
}

export function isValidSourceComponent(componentType: string): boolean {
  return COMPONENT_PORTS[componentType] !== undefined;
}

export function isValidTargetComponent(componentType: string): boolean {
  return COMPONENT_PORTS[componentType] !== undefined;
}

export function getComponentLabel(componentType: string): string {
  return COMPONENT_PORTS[componentType]?.label || componentType;
}

export function getAllComponentTypes(): string[] {
  return Object.keys(COMPONENT_PORTS);
}
