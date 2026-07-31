import { iconRegistry } from '@/lib/iconRegistry';

export type NodeIconSource = 'manual' | 'technology' | 'component' | 'label' | 'serviceType' | 'fallback';

export interface ResolveNodeIconInput {
  label?: string;
  typeId?: string;
  componentType?: string;
  serviceType?: string;
  technology?: string;
  category?: string;
  icon?: string;
  color?: string;
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
  api_gateway: { icon: 'arch-api-gateway' },
  bff_gateway: { icon: 'arch-api-gateway' },
  message_queue: { icon: 'arch-message-queue' },
  event_bus: { icon: 'arch-event-stream' },
  kafka_streaming: { icon: 'arch-event-stream' },
  load_balancer: { icon: 'arch-load-balancer' },
  reverse_proxy: { icon: 'arch-api-gateway' },
  sql_db: { icon: 'arch-database' },
  nosql_db: { icon: 'arch-database' },
  in_memory_cache: { icon: 'arch-cache' },
  app_cache: { icon: 'arch-cache' },
  cdn_cache: { icon: 'arch-storage' },
  rest_api: { icon: 'arch-api-gateway' },
  graphql_federation: { icon: 'arch-api-gateway' },
  graphql_subgraph: { icon: 'arch-api-gateway' },
};

const SERVICE_TYPE_ICON_MAP: Record<string, string> = {
  client: 'arch-web',
  database: 'arch-database',
  queue: 'arch-message-queue',
  'load-balancer': 'arch-load-balancer',
  gateway: 'arch-api-gateway',
  api: 'arch-api-gateway',
  ai: 'arch-ai',
  server: 'arch-server',
  docker: 'arch-docker',
  service: 'arch-service',
  'external-service': 'arch-external',
  observability: 'arch-observability',
};

const LABEL_MATCHERS: Array<{
  source: NodeIconSource;
  icon: string;
  technology?: string;
  color?: string;
  test: RegExp;
}> = [
  { source: 'label', icon: 'arch-producer', test: /\b(producer|publisher|sender)\b/i },
  { source: 'label', icon: 'arch-consumer-group', test: /\b(consumer group|subscriber group)\b/i },
  { source: 'label', icon: 'arch-consumer', test: /\b(consumer|subscriber|receiver)\b/i },
  { source: 'label', icon: 'arch-broker', test: /\b(kafka broker|broker node|message broker)\b/i },
  { source: 'label', icon: 'arch-topic', test: /\b(topic|stream topic)\b/i },
  { source: 'label', icon: 'arch-partition', test: /\b(partition|shard)\b/i },
  { source: 'label', icon: 'arch-coordinator', test: /\b(zookeeper|coordinator|coordination)\b/i },
  { source: 'label', icon: 'arch-web', test: /\b(web|browser|frontend|client|ui)\b/i },
  { source: 'label', icon: 'arch-mobile', test: /\b(mobile|ios|android|phone)\b/i },
  { source: 'label', icon: 'arch-api-gateway', test: /\b(api gateway|gateway|bff|rest api|graphql)\b/i },
  { source: 'label', icon: 'arch-load-balancer', test: /\b(load balancer|balancer|lb|ingress)\b/i },
  { source: 'label', icon: 'arch-message-queue', test: /\b(queue|message queue|broker|mq|pub\/sub|pubsub|topic)\b/i },
  { source: 'label', icon: 'arch-event-stream', test: /\bkafka\b/i },
  { source: 'label', icon: 'arch-message-queue', test: /\brabbitmq\b/i },
  { source: 'label', icon: 'arch-database', test: /\b(postgres|postgresql)\b/i },
  { source: 'label', icon: 'arch-database', test: /\bmysql\b/i },
  { source: 'label', icon: 'arch-database', test: /\b(mongodb|mongo)\b/i },
  { source: 'label', icon: 'arch-cache', test: /\b(redis|cache)\b/i },
  { source: 'label', icon: 'arch-storage', test: /\b(storage|bucket|blob|s3)\b/i },
  { source: 'label', icon: 'arch-auth', test: /\b(auth|login|identity|oauth|session)\b/i },
  { source: 'label', icon: 'arch-ai', test: /\b(ai|llm|model|embedding|vector|openai|claude)\b/i },
  { source: 'label', icon: 'arch-observability', test: /\b(log|metric|monitor|observability|dashboard|trace|alert)\b/i },
  { source: 'label', icon: 'Mail', test: /\b(email|mail)\b/i },
  { source: 'label', icon: 'CreditCard', test: /\b(payment|billing|invoice|card)\b/i },
  { source: 'label', icon: 'arch-server', test: /\b(server|backend|worker|daemon)\b/i },
  { source: 'label', icon: 'arch-service', test: /\b(service|processor|job)\b/i },
];

function getTechnologyEntry(technology?: string) {
  return technology ? iconRegistry[technology] : undefined;
}

export function resolveNodeIcon(input: ResolveNodeIconInput): ResolvedNodeIcon {
  const fallbackColor = input.color || '#6B7280';

  if (input.icon && input.icon.trim()) {
    return { icon: input.icon, color: fallbackColor, technology: input.technology, source: 'manual' };
  }

  const techEntry = getTechnologyEntry(input.technology);
  if (techEntry) {
    // If the technology uses a custom icon, return it directly
    if (techEntry.kind === 'custom' || techEntry.icon.startsWith('arch-')) {
      return { icon: techEntry.icon, color: techEntry.color, technology: input.technology, source: 'technology' };
    }
    // For AWS icons, return the AWS icon name
    if (techEntry.kind === 'aws') {
      return { icon: techEntry.icon, color: techEntry.color, technology: input.technology, source: 'technology' };
    }
    // For lucide icons, return the lucide icon name
    return { icon: techEntry.icon, color: techEntry.color, technology: input.technology, source: 'technology' };
  }

  const componentKey = input.typeId || input.componentType;
  const componentIcon = componentKey ? COMPONENT_ICON_MAP[componentKey] : undefined;
  if (componentIcon) {
    // Component icons are already custom icon names (arch-*), so pass them through
    return {
      icon: componentIcon.icon,
      color: fallbackColor,
      technology: componentIcon.technology,
      source: 'component',
    };
  }

  const label = input.label || '';
  const labelMatch = LABEL_MATCHERS.find((matcher) => matcher.test.test(label));
  if (labelMatch) {
    // Label matchers may return either custom icons or lucide icons
    if (labelMatch.icon.startsWith('arch-')) {
      return {
        icon: labelMatch.icon,
        color: labelMatch.color || fallbackColor,
        technology: labelMatch.technology,
        source: 'label',
      };
    }
    // For non-custom icons, check if there's a technology entry
    const labelTechEntry = getTechnologyEntry(labelMatch.technology);
    return {
      icon: labelTechEntry?.icon || labelMatch.icon,
      color: labelTechEntry?.color || labelMatch.color || fallbackColor,
      technology: labelMatch.technology,
      source: 'label',
    };
  }

  const serviceIcon = input.serviceType ? SERVICE_TYPE_ICON_MAP[input.serviceType] : undefined;
  if (serviceIcon) {
    // Service type icons are already custom icon names (arch-*), so pass them through
    return { icon: serviceIcon, color: fallbackColor, technology: input.technology, source: 'serviceType' };
  }

  return { icon: 'arch-service', color: fallbackColor, technology: input.technology, source: 'fallback' };
}
