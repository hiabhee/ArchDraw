export function getDeterministicColor(str: string): string {
  const colors = ['#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
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
    lower.includes('cache') || lower.includes('redis') ||
    lower.includes('postgres') || lower.includes('mysql') ||
    lower.includes('mongodb') || lower.includes('dynamodb') ||
    lower.includes('cassandra') || lower.includes('data store') ||
    lower.includes('lake') || lower.includes('store') ||
    lower.includes('storage') || lower.includes('warehouse') ||
    lower.includes('s3') || lower.includes('bucket') ||
    lower.includes('firestore')
  ) return { shape: 'cylinder', serviceType: 'database' }

  if (
    lower.includes('load balancer') || lower.includes('lb') ||
    lower.includes('gateway') || lower.includes('api gateway') ||
    lower.includes('proxy') || lower.includes('ingress') ||
    lower.includes('traff') || lower.includes('gw')
  ) return { shape: 'diamond', serviceType: 'load-balancer' }

  if (
    lower.includes('queue') || lower.includes('broker') ||
    lower.includes('kafka') || lower.includes('rabbitmq') ||
    lower.includes('message bus') || lower.includes('event') ||
    lower.includes('pub/sub') || lower.includes('stream') ||
    lower.includes('topic') || lower.includes('mq')
  ) return { shape: 'circle', serviceType: 'queue' }

  if (
    lower.includes('external') || lower.includes('third party') ||
    lower.includes('saas') || lower.includes('cdn') ||
    lower.includes('cloud') || lower.includes('vpc')
  ) return { shape: 'hexagon', serviceType: 'external-service' }

  if (
    lower === 'user' || lower === 'client' ||
    lower.includes('browser') || lower.includes('mobile') ||
    lower.includes('desktop') || lower.includes('app')
  ) return { shape: 'rounded', serviceType: 'client' }

  if (
    lower.includes('log') || lower.includes('monitor') ||
    lower.includes('observability') || lower.includes('metric') ||
    lower.includes('tracing') || lower.includes('alert')
  ) return { shape: 'rounded', serviceType: 'observability' }

  // 2. Group name fallback (if name is ambiguous/generic, e.g. "Auth" or "Billing")
  if (groupName) {
    const g = groupName.toLowerCase()
    if (g.includes('client')) {
      return { shape: 'rounded', serviceType: 'client' }
    }
    if (g.includes('data') || g.includes('storage') || g.includes('database')) {
      return { shape: 'cylinder', serviceType: 'database' }
    }
    if (g.includes('gateway') || g.includes('lb') || g.includes('load')) {
      return { shape: 'diamond', serviceType: 'load-balancer' }
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
  'client':           { typeId: 'client',            icon: 'Monitor',   category: 'client' },
  'observability':    { typeId: 'observability',     icon: 'Activity',  category: 'observability' },
  'service':          { typeId: 'service',           icon: 'Box',       category: 'compute' },
}

// Category-based color overrides (applied on top of theme primary color)
export const CATEGORY_COLORS: Record<string, string> = {
  'data':           '#1e293b',
  'networking':     '#4F46E5',
  'messaging':      '#0891b2',
  'external':       '#64748b',
  'client':         '#2563EB',
  'observability':  '#475569',
  'compute':        '#4F46E5',
}
