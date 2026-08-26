export function getDeterministicColor(str: string): string {
  const colors = ['#2563eb', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}


// ── Unified classification — single source of truth for shape + serviceType ──

export interface NodeClassification {
  shape: string
  serviceType: string
}

export function classifyNode(name: string, groupName?: string): NodeClassification {
  const lower = name.toLowerCase()

  // 1. Name-based primary check (high-confidence visual symbols)
  if (
    lower.includes('database') || lower.includes('db') ||
    lower.includes('postgres') || lower.includes('mysql') ||
    lower.includes('mongodb') || lower.includes('dynamodb') ||
    lower.includes('cassandra') || lower.includes('data store') ||
    lower.includes('lake') || lower.includes('warehouse') ||
    lower.includes('firestore')
  ) return { shape: 'cylinder', serviceType: 'database' }

  if (
    lower.includes('cache') || lower.includes('redis') ||
    lower.includes('memcached') || lower.includes('elasticache') ||
    lower.includes('cdn cache') || lower.includes('varnish')
  ) return { shape: 'cache', serviceType: 'cache' }

  if (
    lower.includes('s3') || lower.includes('bucket') ||
    lower.includes('blob') || lower.includes('gcs') ||
    lower.includes('object storage') || lower.includes('object-storage') ||
    lower.includes('azureblob') || lower.includes('minio')
  ) return { shape: 'bucket', serviceType: 'storage' }

  if (
    lower.includes('store') || lower.includes('storage') ||
    lower.includes('warehouse') || lower.includes('lake')
  ) return { shape: 'cylinder', serviceType: 'database' }

  if (
    lower.includes('load balancer') || lower.includes('lb') ||
    lower.includes('gateway') || lower.includes('api gateway') ||
    lower.includes('proxy') || lower.includes('ingress') ||
    lower.includes('nginx') || lower.includes('traff') || lower.includes('gw')
  ) return { shape: 'hexagon', serviceType: 'load-balancer' }

  if (
    lower.includes('queue') || lower.includes('broker') ||
    lower.includes('kafka') || lower.includes('rabbitmq') ||
    lower.includes('message bus') || lower.includes('event') ||
    lower.includes('pub/sub') || lower.includes('stream') ||
    lower.includes('topic') || lower.includes('mq') ||
    lower.includes('nats') || lower.includes('kinesis') ||
    lower.includes('sqs') || lower.includes('sns') ||
    lower.includes('pubsub') || lower.includes('eventbus')
  ) return { shape: 'queue', serviceType: 'queue' }

  if (
    lower.includes('firewall') || lower.includes('waf') ||
    lower.includes('vault') || lower.includes('oauth') ||
    lower.includes('keycloak') || lower.includes('secrets') ||
    lower.includes('jwt') || lower.includes('tls') ||
    lower.includes('ssl') || lower.includes('auth') ||
    lower.includes('identity') || lower.includes('sso')
  ) return { shape: 'rounded-rectangle', serviceType: 'security' }

  if (
    lower.includes('lambda') || lower.includes('cloud function') ||
    lower.includes('edge worker') || lower.includes('serverless') ||
    lower.includes('function') || lower.includes('webhook') ||
    lower.includes('cronjob') || lower.includes('cron job') ||
    lower.includes('scheduled')
  ) return { shape: 'function', serviceType: 'function' }

  if (
    lower.includes('docker') || lower.includes('container') ||
    lower.includes(' pod') || lower.startsWith('pod') ||
    lower.includes('kubernetes') || lower.includes('k8s') ||
    lower.includes('deployment')
  ) return { shape: 'container', serviceType: 'container' }

  if (
    lower.includes('external') || lower.includes('third party') ||
    lower.includes('saas') || lower.includes('cdn') ||
    lower.includes('cloud') || lower.includes('vpc') ||
    lower.includes('stripe') || lower.includes('sendgrid')
  ) return { shape: 'cloud', serviceType: 'external-service' }

  // Actor (person) — only actual human end-users, not system operators/developers
  if (
    lower === 'user' || lower === 'actor' || lower === 'customer' ||
    lower.includes('person')
  ) return { shape: 'actor', serviceType: 'actor' }

  if (
    lower.includes('mobile') || lower.includes('ios') ||
    lower.includes('android') || lower.includes('react native') ||
    lower.includes('flutter')
  ) return { shape: 'mobile', serviceType: 'mobile' }

  if (
    lower === 'client' ||
    lower.includes('browser') || lower.includes('webapp') ||
    lower.includes('frontend') || lower.includes('spa') ||
    lower.includes('pwa') || lower.includes('desktop') ||
    lower.includes('web') || lower.includes('app')
  ) return { shape: 'monitor', serviceType: 'client' }

  if (
    lower.includes('log') || lower.includes('monitor') ||
    lower.includes('observability') || lower.includes('metric') ||
    lower.includes('tracing') || lower.includes('alert')
  ) return { shape: 'rounded', serviceType: 'observability' }

  // 2. Group name fallback (if name is ambiguous/generic, e.g. "Auth" or "Billing")
  if (groupName) {
    const g = groupName.toLowerCase()
    if (g.includes('client') || g.includes('user') || g.includes('customer')) {
      return { shape: 'monitor', serviceType: 'client' }
    }
    if (g.includes('data') || g.includes('storage') || g.includes('database')) {
      return { shape: 'cylinder', serviceType: 'database' }
    }
    if (g.includes('gateway') || g.includes('lb') || g.includes('load')) {
      return { shape: 'hexagon', serviceType: 'load-balancer' }
    }
    if (g.includes('security') || g.includes('auth')) {
      return { shape: 'rounded-rectangle', serviceType: 'security' }
    }
    if (g.includes('external') || g.includes('third') || g.includes('saas')) {
      return { shape: 'cloud', serviceType: 'external-service' }
    }
    if (g.includes('observability') || g.includes('monitor') || g.includes('log')) {
      return { shape: 'rounded', serviceType: 'observability' }
    }
  }

  // 3. Absolute fallback
  return { shape: 'rounded', serviceType: 'service' }
}

export const SERVICE_TYPE_META: Record<string, { typeId: string; icon: string; category: string }> = {
  'database':         { typeId: 'database',         icon: 'Database',  category: 'data' },
  'load-balancer':    { typeId: 'load-balancer',    icon: 'GitBranch', category: 'networking' },
  'queue':            { typeId: 'queue',             icon: 'Inbox',     category: 'messaging' },
  'external-service': { typeId: 'external-service',  icon: 'Globe',     category: 'external' },
  'security':         { typeId: 'security',          icon: 'Shield',    category: 'compute' },
  'client':           { typeId: 'client',            icon: 'Monitor',   category: 'client' },
  'mobile':           { typeId: 'mobile',            icon: 'Smartphone', category: 'client' },
  'actor':            { typeId: 'actor',             icon: 'User',      category: 'client' },
  'observability':    { typeId: 'observability',     icon: 'Activity',  category: 'observability' },
  'service':          { typeId: 'service',           icon: 'Box',       category: 'compute' },
  // New architecture-native service types
  'cache':            { typeId: 'cache',             icon: 'Zap',       category: 'data' },
  'function':         { typeId: 'function',          icon: 'Code',      category: 'serverless' },
  'container':        { typeId: 'container',         icon: 'Box',       category: 'compute' },
  'storage':          { typeId: 'storage',           icon: 'HardDrive', category: 'storage' },
}

// Category-based color overrides (applied on top of theme primary color)
export const CATEGORY_COLORS: Record<string, string> = {
  'data':           '#1e293b',
  'networking':     '#1E90FF',
  'messaging':      '#0891b2',
  'external':       '#64748b',
  'client':         '#2563EB',
  'observability':  '#475569',
  'compute':        '#2563eb',
  'serverless':     '#2563eb',
  'storage':        '#0369a1',
}
