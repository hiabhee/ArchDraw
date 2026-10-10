import { COMPONENT_TOOLTIPS, type RichTooltipData } from '@/data/componentTooltips';

/** Map tutorial component labels → COMPONENT_TOOLTIPS keys. */
const COMPONENT_ALIASES: Record<string, string> = {
  'Web Client': 'Web',
  'Mobile Client': 'Mobile',
  'Auth Service': 'Auth',
  'Database': 'SQL Database',
  'SQL Database': 'SQL Database',
  'NoSQL Database': 'NoSQL Database',
  'In-Memory Cache': 'In-Memory Cache',
  'Cache': 'Cache',
  'Message Service': 'Message Queue',
  'Chat Service': 'Microservice',
  'Voice Service': 'Media Server',
  'Media Server': 'Media Server',
  'Audio CDN': 'CDN',
  'CDN Cache': 'CDN',
  'LLM API': 'LLM',
  'RAG Pipeline': 'Embedding Service',
  'Text Splitter': 'Embedding',
  'Upload Service': 'Worker',
  'Media Service': 'Worker',
  'Transcoding Worker': 'Worker',
  'User Service': 'Microservice',
  'Tweet Service': 'Microservice',
  'Block Service': 'Microservice',
  'Cart Service': 'Cart',
  'Payment Service': 'Payment Gateway',
  'Search Service': 'Search',
  'Recommendation Service': 'Recommendation Service',
  'Data Catalog': 'Data Warehouse',
  'Matching Service': 'Location Service',
  'Pricing Engine': 'Pricing Engine',
  'Signaling Server': 'Signaling',
  'OTEL Collector': 'OTEL Collector',
  'OpenTelemetry Collector': 'OTEL Collector',
  'Alert Manager': 'Observability',
  'Model Server': 'LLM',
  'Third Party API': 'Webhook',
  'Agent Orchestrator': 'Microservice',
  'Tool Registry': 'Microservice',
  'Agent Memory': 'In-Memory Cache',
  'Agent Supervisor': 'Microservice',
  'Real-time Service': 'CRDT',
  'CRDT Engine': 'CRDT',
  'Tracing Service': 'Observability',
  'Analytics Service': 'Analytics Service',
  'Webhook Handler': 'Webhook Handler',
  'Fraud Detection Service': 'Fraud Detection Service',
};

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function lookupTooltip(key: string): RichTooltipData | undefined {
  if (COMPONENT_TOOLTIPS[key]) return COMPONENT_TOOLTIPS[key];

  const alias = COMPONENT_ALIASES[key];
  if (alias && COMPONENT_TOOLTIPS[alias]) return COMPONENT_TOOLTIPS[alias];

  const stripped = key.replace(/\s+Client$/i, '').replace(/\s+Service$/i, '').trim();
  if (stripped !== key && COMPONENT_TOOLTIPS[stripped]) return COMPONENT_TOOLTIPS[stripped];

  const norm = normalizeKey(key);
  for (const [tooltipKey, data] of Object.entries(COMPONENT_TOOLTIPS)) {
    const tk = normalizeKey(tooltipKey);
    if (tk === norm || norm.includes(tk) || tk.includes(norm)) {
      return data;
    }
  }

  return undefined;
}

export function genericTeachingFallback(component: string): Pick<RichTooltipData, 'whyItMatters' | 'tradeoff'> {
  return {
    whyItMatters: `Without ${component}, the rest of this architecture cannot function — requests would fail or data would never reach the right place.`,
    tradeoff: `${component} adds operational cost and another failure domain; teams must decide when its benefits outweigh running simpler alternatives.`,
  };
}

/**
 * Resolve tooltip data for a tutorial step component label.
 * Falls back to generic pedagogy copy so strict lint always passes.
 */
export function resolveComponentTooltip(component: string): Pick<RichTooltipData, 'whyItMatters' | 'tradeoff'> {
  const tooltip = lookupTooltip(component);
  const fallback = genericTeachingFallback(component);
  return {
    whyItMatters: tooltip?.whyItMatters ?? fallback.whyItMatters,
    tradeoff: tooltip?.tradeoff ?? fallback.tradeoff,
  };
}
