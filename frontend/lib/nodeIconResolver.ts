import { iconRegistry } from '@/lib/iconRegistry';
import { normalizeArchIconName } from '@/lib/iconAliases';
import { classifyCloudNode, getNodeProviderAffinity, normalizeCloudLabel } from '@/lib/cloudIcons/classifier';
import { CLOUD_BRAND_COLORS } from '@/lib/cloudIcons/dictionaries';
import { inferBrandTechnologyFromLabel } from '@/lib/brandIcons';
import { AWS_COMPONENTS, DB_COMPONENTS, SERVICES_COMPONENTS } from '@/lib/componentRegistry';
import { resolveKubernetesRole, isKubernetesContext } from '@/lib/kubernetes';
import { resolveSemanticColorForIcon, normalizeColor } from '@/lib/semanticColors';

export type NodeIconSource = 'manual' | 'kubernetes-role' | 'explicit-role' | 'technology' | 'component' | 'label' | 'serviceType' | 'fallback';

export interface ResolveNodeIconInput {
  label?: string;
  typeId?: string;
  componentType?: string;
  serviceType?: string;
  technology?: string;
  category?: string;
  icon?: string;
  color?: string;
  /** Dark-mode flag for brand-color normalization; defaults to light. */
  isDark?: boolean;
}

export interface ResolvedNodeIcon {
  icon: string;
  color: string;
  technology?: string;
  source: NodeIconSource;
}

const COMPONENT_ICON_MAP: Record<string, Pick<ResolvedNodeIcon, 'icon' | 'technology'>> = {
  client_web: { icon: 'arch-web' },
  client_mobile: { icon: 'arch-mobile' },
  dns: { icon: 'arch-dns' },
  cdn: { icon: 'arch-cdn' },
  api_gateway: { icon: 'arch-api-gateway' },
  bff_gateway: { icon: 'arch-api-gateway' },
  load_balancer: { icon: 'arch-load-balancer' },
  reverse_proxy: { icon: 'arch-proxy' },
  server_monolith: { icon: 'arch-server' },
  microservice: { icon: 'arch-service' },
  serverless_fn: { icon: 'arch-function' },
  upload_service: { icon: 'arch-upload' },
  user_service: { icon: 'arch-users' },
  chat_service: { icon: 'arch-chat' },
  token_streaming: { icon: 'arch-realtime' },
  otel_collector: { icon: 'arch-trace' },
  worker_job: { icon: 'arch-worker' },
  container: { icon: 'arch-docker' },
  message_queue: { icon: 'arch-message-queue' },
  event_bus: { icon: 'arch-event-stream' },
  kafka_streaming: { icon: 'arch-event-stream' },
  webhook: { icon: 'arch-webhook' },
  sql_db: { icon: 'arch-database' },
  nosql_db: { icon: 'arch-document-db' },
  object_storage: { icon: 'arch-storage' },
  file_system: { icon: 'arch-file' },
  search_engine: { icon: 'arch-search' },
  data_warehouse: { icon: 'arch-warehouse' },
  in_memory_cache: { icon: 'arch-cache' },
  app_cache: { icon: 'arch-cache' },
  cdn_cache: { icon: 'arch-cdn' },
  rest_api: { icon: 'arch-api-gateway' },
  graphql_federation: { icon: 'arch-graphql' },
  graphql_subgraph: { icon: 'arch-graphql' },
  auth_service: { icon: 'arch-auth' },
  oauth_provider: { icon: 'arch-auth' },
  api_key_manager: { icon: 'arch-secrets' },
  firewall_waf: { icon: 'arch-firewall' },
  logger: { icon: 'arch-logs' },
  metrics_collector: { icon: 'arch-metrics' },
  tracing_service: { icon: 'arch-trace' },
  alert_manager: { icon: 'arch-notification' },
  dashboard: { icon: 'arch-observability' },
  llm_api: { icon: 'arch-ai' },
  vector_db: { icon: 'arch-vector' },
  embedding_service: { icon: 'arch-vector' },
  rag_pipeline: { icon: 'arch-ai' },
  model_server: { icon: 'arch-ai' },
  email_service: { icon: 'arch-email' },
  payment_gateway: { icon: 'arch-payment' },
  sms_push: { icon: 'arch-notification' },
  maps_api: { icon: 'arch-maps' },
  third_party_api: { icon: 'arch-external' },
  cicd_pipeline: { icon: 'arch-cicd' },
  container_registry: { icon: 'arch-registry' },
  secret_manager: { icon: 'arch-secrets' },
  config_service: { icon: 'arch-config' },
  ai_agent: { icon: 'arch-agent' },
  agent_orchestrator: { icon: 'arch-coordinator' },
  multi_agent_system: { icon: 'arch-users' },
  agent_memory: { icon: 'arch-ai' },
  agent_planner: { icon: 'arch-config' },
  agent_executor: { icon: 'arch-function' },
  tool_registry: { icon: 'arch-registry' },
  agent_supervisor: { icon: 'arch-firewall' },
  reflection_module: { icon: 'arch-observability' },
  task_decomposer: { icon: 'arch-partition' },
  agent_router: { icon: 'arch-proxy' },
  critic_agent: { icon: 'arch-agent' },
  // Properties panel / service-type ids
  service: { icon: 'arch-service' },
  database: { icon: 'arch-database' },
  queue: { icon: 'arch-message-queue' },
  'load-balancer': { icon: 'arch-load-balancer' },
  client: { icon: 'arch-web' },
  'external-service': { icon: 'arch-external' },
  observability: { icon: 'arch-observability' },
  'api-gateway': { icon: 'arch-api-gateway' },
  cache: { icon: 'arch-cache' },
  function: { icon: 'arch-function' },
  'auth-service': { icon: 'arch-auth' },
  monitoring: { icon: 'arch-metrics' },
};

const SERVICE_TYPE_ICON_MAP: Record<string, string> = {
  client: 'arch-web',
  database: 'arch-database',
  queue: 'arch-message-queue',
  'load-balancer': 'arch-load-balancer',
  gateway: 'arch-api-gateway',
  api: 'arch-api-gateway',
  'api-gateway': 'arch-api-gateway',
  ai: 'arch-ai',
  server: 'arch-server',
  docker: 'arch-docker',
  container: 'arch-docker',
  service: 'arch-service',
  'external-service': 'arch-external',
  observability: 'arch-observability',
  monitoring: 'arch-metrics',
  cache: 'arch-cache',
  function: 'arch-function',
  cdn: 'arch-cdn',
  'auth-service': 'arch-auth',
  auth: 'arch-auth',
  search: 'arch-search',
  worker: 'arch-worker',
  payment: 'arch-payment',
  email: 'arch-email',
};

const LABEL_MATCHERS: Array<{
  source: NodeIconSource;
  icon: string;
  technology?: string;
  color?: string;
  test: RegExp;
}> = [
  { source: 'label', icon: 'arch-database', technology: 'supabase', test: /\bsupabase\b/i },
  { source: 'label', icon: 'arch-grpc', test: /\b(grpc|protobuf)\b/i },
  { source: 'label', icon: 'arch-scheduler', test: /\b(scheduler|cron|scheduled job)\b/i },
  { source: 'label', icon: 'arch-batch', test: /\b(batch|bulk process)\b/i },
  { source: 'label', icon: 'arch-etl', test: /\b(etl|extract transform|data pipeline)\b/i },
  { source: 'label', icon: 'arch-stream-processor', test: /\b(stream process|flink|spark streaming)\b/i },
  { source: 'label', icon: 'arch-dead-letter', test: /\b(dead letter|dlq)\b/i },
  { source: 'label', icon: 'arch-sso', test: /\b(sso|single sign.?on|saml)\b/i },
  { source: 'label', icon: 'arch-circuit-breaker', test: /\b(circuit breaker|resilience)\b/i },
  { source: 'label', icon: 'arch-workflow', test: /\b(workflow|orchestration|temporal|airflow)\b/i },
  { source: 'label', icon: 'arch-knowledge', test: /\b(knowledge base|rag store|document store)\b/i },
  { source: 'label', icon: 'arch-health-check', test: /\b(health check|liveness|readiness probe)\b/i },
  { source: 'label', icon: 'arch-timeseries', test: /\b(time.?series|influx|prometheus tsdb|timescale)\b/i },
  { source: 'label', icon: 'arch-replication', test: /\b(replica|replication|read replica)\b/i },
  { source: 'label', icon: 'arch-backup', test: /\b(backup|snapshot|archive)\b/i },
  { source: 'label', icon: 'arch-cluster', test: /\b(cluster|node pool)\b/i },
  { source: 'label', icon: 'arch-vm', test: /\b(virtual machine|vm|ec2|compute engine)\b/i },
  { source: 'label', icon: 'arch-router', test: /\b(router|route table)\b/i },
  { source: 'label', icon: 'arch-terminal', test: /\b(cli|terminal|shell|command line)\b/i },
  { source: 'label', icon: 'arch-desktop', test: /\b(desktop app|desktop client)\b/i },
  { source: 'label', icon: 'arch-download', test: /\b(download|export service)\b/i },
  { source: 'label', icon: 'arch-producer', test: /\b(producer|publisher|sender)\b/i },
  { source: 'label', icon: 'arch-consumer-group', test: /\b(consumer group|subscriber group)\b/i },
  { source: 'label', icon: 'arch-consumer', test: /\b(consumer|subscriber|receiver)\b/i },
  { source: 'label', icon: 'arch-broker', test: /\b(kafka broker|broker node|message broker)\b/i },
  { source: 'label', icon: 'arch-topic', test: /\b(topic|stream topic)\b/i },
  { source: 'label', icon: 'arch-partition', test: /\b(partition|shard)\b/i },
  { source: 'label', icon: 'arch-coordinator', test: /\b(zookeeper|coordinator|coordination|orchestrat)\b/i },
  { source: 'label', icon: 'arch-cdn', test: /\b(cdn|cloudfront|content delivery|edge cache)\b/i },
  { source: 'label', icon: 'arch-dns', test: /\b(dns|route\s*53|name server)\b/i },
  { source: 'label', icon: 'arch-search', test: /\b(search|elasticsearch|algolia|opensearch|meilisearch|typesense)\b/i },
  { source: 'label', icon: 'arch-function', test: /\b(lambda|cloud function|serverless|azure function)\b/i },
  { source: 'label', icon: 'arch-worker', test: /\b(worker|job runner|cron|background job)\b/i },
  { source: 'label', icon: 'arch-payment', test: /\b(payment|billing|invoice|stripe|card)\b/i },
  { source: 'label', icon: 'arch-email', test: /\b(email|mail|smtp|ses)\b/i },
  { source: 'label', icon: 'arch-notification', test: /\b(notification|push|sms|pagerduty|alert)\b/i },
  { source: 'label', icon: 'arch-firewall', test: /\b(firewall|waf|security group)\b/i },
  { source: 'label', icon: 'arch-vector', test: /\b(vector|embedding|pinecone|weaviate|chroma|milvus)\b/i },
  { source: 'label', icon: 'arch-kubernetes', test: /\b(kubernetes|k8s|eks|aks|gke)\b/i },
  { source: 'label', icon: 'arch-cicd', test: /\b(ci\/?cd|pipeline|github actions|codepipeline|build)\b/i },
  { source: 'label', icon: 'arch-document-db', test: /\b(mongodb|mongo|documentdb|firestore|cosmos)\b/i },
  { source: 'label', icon: 'arch-key-value', test: /\b(dynamodb|key.?value|kv store)\b/i },
  { source: 'label', icon: 'arch-warehouse', test: /\b(warehouse|redshift|bigquery|snowflake|analytics db)\b/i },
  { source: 'label', icon: 'arch-graphql', test: /\b(graphql)\b/i },
  { source: 'label', icon: 'arch-proxy', test: /\b(reverse proxy|nginx|envoy|proxy)\b/i },
  { source: 'label', icon: 'arch-secrets', test: /\b(secret|vault|key manager|kms)\b/i },
  { source: 'label', icon: 'arch-metrics', test: /\b(metric|prometheus|grafana)\b/i },
  { source: 'label', icon: 'arch-logs', test: /\b(log|logging|cloudwatch logs)\b/i },
  { source: 'label', icon: 'arch-trace', test: /\b(trace|tracing|x-?ray|otel|opentelemetry|jaeger)\b/i },
  { source: 'label', icon: 'arch-file', test: /\b(file system|nfs|efs|filesystem)\b/i },
  { source: 'label', icon: 'arch-webhook', test: /\b(webhook)\b/i },
  { source: 'label', icon: 'arch-chat', test: /\b(chat|messaging ui|conversation)\b/i },
  { source: 'label', icon: 'arch-upload', test: /\b(upload|file upload)\b/i },
  { source: 'label', icon: 'arch-config', test: /\b(config|configuration|feature flag)\b/i },
  { source: 'label', icon: 'arch-registry', test: /\b(registry|ecr|artifact|container registry)\b/i },
  { source: 'label', icon: 'arch-agent', test: /\b(ai agent|agent|bot)\b/i },
  { source: 'label', icon: 'arch-realtime', test: /\b(websocket|realtime|real-time|streaming token)\b/i },
  { source: 'label', icon: 'arch-maps', test: /\b(map|maps|geolocation|geo)\b/i },
  { source: 'label', icon: 'arch-users', test: /\b(user service|users|identity store)\b/i },
  { source: 'label', icon: 'arch-web', test: /\b(web|browser|frontend|client|ui)\b/i },
  { source: 'label', icon: 'arch-mobile', test: /\b(mobile|ios|android|phone)\b/i },
  { source: 'label', icon: 'arch-api-gateway', test: /\b(api gateway|gateway|bff|rest api)\b/i },
  { source: 'label', icon: 'arch-load-balancer', test: /\b(load balancer|balancer|lb|ingress)\b/i },
  { source: 'label', icon: 'arch-message-queue', test: /\b(queue|message queue|mq|pub\/sub|pubsub)\b/i },
  { source: 'label', icon: 'arch-event-stream', technology: 'kafka', test: /\bkafka\b/i },
  { source: 'label', icon: 'arch-message-queue', technology: 'rabbitmq', test: /\brabbitmq\b/i },
  { source: 'label', icon: 'arch-proxy', technology: 'nginx', test: /\bnginx\b/i },
  { source: 'label', icon: 'arch-docker', technology: 'docker', test: /\bdocker\b/i },
  { source: 'label', icon: 'arch-server', test: /\b(gunicorn|uwsgi|uvicorn)\b/i },
  { source: 'label', icon: 'arch-database', technology: 'postgresql', test: /\b(postgres|postgresql)\b/i },
  { source: 'label', icon: 'arch-database', technology: 'mysql', test: /\bmysql\b/i },
  { source: 'label', icon: 'arch-database', technology: 'mongodb', test: /\b(mongodb|mongo)\b/i },
  { source: 'label', icon: 'arch-database', test: /\b(sqlite|rds|sql)\b/i },
  { source: 'label', icon: 'arch-cache', technology: 'redis', test: /\bredis\b/i },
  { source: 'label', icon: 'arch-cache', test: /\b(cache|memcached|elasticache)\b/i },
  { source: 'label', icon: 'arch-storage', test: /\b(storage|bucket|blob|s3)\b/i },
  { source: 'label', icon: 'arch-auth', test: /\b(auth|login|identity|oauth|session|cognito)\b/i },
  { source: 'label', icon: 'arch-ai', test: /\b(ai|llm|model|openai|claude|gemini)\b/i },
  { source: 'label', icon: 'arch-observability', test: /\b(monitor|observability|dashboard)\b/i },
  { source: 'label', icon: 'arch-docker', test: /\b(docker|container)\b/i },
  { source: 'label', icon: 'arch-server', test: /\b(server|backend|daemon|monolith)\b/i },
  { source: 'label', icon: 'arch-service', test: /\b(service|processor|microservice)\b/i },
];

const LABEL_TO_TECHNOLOGY = new Map<string, string>(
  [...AWS_COMPONENTS, ...DB_COMPONENTS, ...SERVICES_COMPONENTS]
    .filter((comp) => comp.technology)
    .flatMap((comp) => [
      [normalizeCloudLabel(comp.label), comp.technology!] as const,
      [comp.id, comp.technology!] as const,
    ]),
);

function technologyFromLabel(label?: string): string | undefined {
  const normalized = normalizeCloudLabel(label);
  if (!normalized) return undefined;
  return LABEL_TO_TECHNOLOGY.get(normalized);
}

const ICON_TO_TECHNOLOGY: Record<string, string> = {
  'arch-docker': 'docker',
  'arch-kubernetes': 'kubernetes',
};

function technologyFromIcon(icon?: string): string | undefined {
  if (!icon) return undefined;
  return ICON_TO_TECHNOLOGY[icon];
}

function getTechnologyEntry(technology?: string) {
  return technology ? iconRegistry[technology] : undefined;
}

export function resolveNodeIcon(input: ResolveNodeIconInput): ResolvedNodeIcon {
  const isDark = input.isDark ?? false;
  
  // PRIORITY 1: Explicit arch-/aws-/azure- icon from the properties panel.
  // A recognized technology — named explicitly, or inferred from the icon itself
  // via ICON_TO_TECHNOLOGY (e.g. arch-kubernetes → kubernetes) — brands the node
  // with its official color and wins over a raw manual color. Only genuinely
  // generic icons (no resolvable technology) stay a plain manual override.
  if (input.icon?.startsWith('arch-') || input.icon?.startsWith('aws-') || input.icon?.startsWith('azure-')) {
    const manualTechnology = input.technology ?? technologyFromIcon(input.icon);
    const manualTechEntry = getTechnologyEntry(manualTechnology);
    if (manualTechEntry) {
      return { icon: input.icon, color: manualTechEntry.color, technology: manualTechnology, source: 'technology' };
    }
    const color = normalizeColor(input.color, input.icon, isDark);
    return { icon: input.icon, color, technology: input.technology, source: 'manual' };
  }

  // PRIORITY 2: Kubernetes role resolution (role-specific icons before generic k8s logo)
  // Check if this is a Kubernetes component and resolve its specific role
  const resolvedTechnology =
    input.technology ??
    technologyFromLabel(input.label) ??
    inferBrandTechnologyFromLabel(input.label) ??
    technologyFromIcon(input.icon);
  
  if (isKubernetesContext(input.label, resolvedTechnology)) {
    const k8sRole = resolveKubernetesRole(input.label);
    if (k8sRole) {
      const color = normalizeColor(input.color, k8sRole.icon, isDark);
      return {
        icon: k8sRole.icon,
        color,
        technology: resolvedTechnology,
        source: 'kubernetes-role',
      };
    }
  }

  // PRIORITY 3: Technology with custom arch-* icons or provider icons
  const techEntry = getTechnologyEntry(resolvedTechnology);
  if (techEntry) {
    // If the technology uses a custom icon, return it directly
    if (techEntry.kind === 'custom' || techEntry.icon.startsWith('arch-')) {
      return { icon: techEntry.icon, color: techEntry.color, technology: resolvedTechnology, source: 'technology' };
    }
    // AWS / Azure service keys keep their provider icon id
    if (techEntry.kind === 'aws' || resolvedTechnology?.startsWith('azure-')) {
      return { icon: techEntry.icon, color: techEntry.color, technology: resolvedTechnology, source: 'technology' };
    }
    // Normalize lucide icon names to distinctive arch glyphs when possible
    return {
      icon: normalizeArchIconName(techEntry.icon) || techEntry.icon,
      color: techEntry.color,
      technology: resolvedTechnology,
      source: 'technology',
    };
  }

  // PRIORITY 4: Cloud provider affinity (AWS/Azure from palette or repo import)
  const cloudInput = {
    label: input.label,
    typeId: input.typeId || input.componentType,
    componentId: (input as ResolveNodeIconInput & { componentId?: string }).componentId,
    technology: input.technology,
    serviceType: input.serviceType,
    icon: input.icon,
  };
  const affinity = getNodeProviderAffinity(cloudInput);
  if (affinity) {
    const serviceKey =
      [input.technology, input.typeId, input.componentType, cloudInput.componentId, input.icon].find((key) =>
        key?.startsWith(`${affinity}-`),
      ) ?? null;
    if (serviceKey) {
      return {
        icon: serviceKey,
        color: CLOUD_BRAND_COLORS[affinity],
        technology: serviceKey,
        source: 'technology',
      };
    }
  }

  // PRIORITY 5: Cloud service classification (label-based AWS/Azure matching)
  const cloudCls = classifyCloudNode(cloudInput);
  if (cloudCls.tier === 'cloudService') {
    if (cloudCls.state === 'matchedAWS' && cloudCls.awsMatch) {
      return {
        icon: cloudCls.awsMatch,
        color: CLOUD_BRAND_COLORS.aws,
        technology: cloudCls.awsMatch,
        source: 'label',
      };
    }
    if (cloudCls.state === 'matchedAzure' && cloudCls.azureMatch) {
      return {
        icon: cloudCls.azureMatch,
        color: CLOUD_BRAND_COLORS.azure,
        technology: cloudCls.azureMatch,
        source: 'label',
      };
    }
  }

  // PRIORITY 6: Component type mapping (from palette components)
  const componentKey = input.typeId || input.componentType;
  const componentIcon = componentKey ? COMPONENT_ICON_MAP[componentKey] : undefined;
  if (componentIcon) {
    const color = normalizeColor(input.color, componentIcon.icon, isDark);
    return {
      icon: componentIcon.icon,
      color,
      technology: componentIcon.technology,
      source: 'component',
    };
  }

  // PRIORITY 7: Lucide icon names from properties panel → arch-* glyphs
  const normalizedManual = normalizeArchIconName(input.icon);
  if (normalizedManual && input.icon?.trim()) {
    const color = normalizeColor(input.color, normalizedManual, isDark);
    return {
      icon: normalizedManual,
      color,
      technology: input.technology,
      source: 'manual',
    };
  }

  // PRIORITY 8: Label pattern matching
  const label = input.label || '';
  const labelMatch = LABEL_MATCHERS.find((matcher) => matcher.test.test(label));
  if (labelMatch) {
    // Label matchers may return either custom icons or lucide icons
    if (labelMatch.icon.startsWith('arch-')) {
      const color = normalizeColor(labelMatch.color || input.color, labelMatch.icon, isDark);
      return {
        icon: labelMatch.icon,
        color,
        technology: labelMatch.technology,
        source: 'label',
      };
    }
    // For non-custom icons, check if there's a technology entry
    const labelTechEntry = getTechnologyEntry(labelMatch.technology);
    const finalColor = normalizeColor(
      labelTechEntry?.color || labelMatch.color || input.color,
      labelMatch.icon,
      isDark
    );
    return {
      icon: labelTechEntry?.icon || labelMatch.icon,
      color: finalColor,
      technology: labelMatch.technology,
      source: 'label',
    };
  }

  // PRIORITY 9: Service type mapping
  const serviceIcon = input.serviceType ? SERVICE_TYPE_ICON_MAP[input.serviceType] : undefined;
  if (serviceIcon) {
    const color = normalizeColor(input.color, serviceIcon, isDark);
    return { icon: serviceIcon, color, technology: input.technology, source: 'serviceType' };
  }

  // PRIORITY 10: Final fallback
  const fallbackIcon = 'arch-service';
  const fallbackColor = normalizeColor(input.color, fallbackIcon, isDark);
  return { icon: fallbackIcon, color: fallbackColor, technology: input.technology, source: 'fallback' };
}
