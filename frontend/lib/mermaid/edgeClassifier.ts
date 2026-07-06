import type { RFNode } from './types';

export interface EdgeSemantics {
  importance: 'primary' | 'secondary' | 'supporting' | 'diagnostic' | 'optional';
  syncAsync: 'sync' | 'async';
  portType?: 'inbound' | 'outbound' | 'control' | 'data' | 'events' | 'storage' | 'runtime' | 'external' | 'observability' | 'security';
  protocol?: string;
}

const RESPONSE_LABEL_KEYWORDS = [
  'return', 'response', 'reply', 'ack', 'callback',
  'returns', 'responds', 'sends back', 'confirms',
];

const ASYNC_KEYWORDS = [
  'event', 'publish', 'subscribe', 'emit', 'kafka',
  'message', 'mq', 'queue', 'consume', 'webhook', 'topic',
  'notify', 'stream',
];

const PROTOCOL_MAP_SYNC: Record<string, string> = {
  grpc: 'gRPC',
  rpc: 'RPC',
  graphql: 'GraphQL',
  websocket: 'WebSocket',
  ws: 'WebSocket',
  https: 'HTTPS',
  http: 'HTTP',
  rest: 'REST',
  soap: 'SOAP',
};

const PROTOCOL_MAP_ASYNC: Record<string, string> = {
  kafka: 'Kafka Event',
  webhook: 'Webhook',
  amqp: 'AMQP',
  rabbit: 'AMQP',
  sqs: 'SQS Message',
  sns: 'SNS Notification',
  mqtt: 'MQTT',
};

const OBSERVABILITY_NAMES = [
  'observability', 'prometheus', 'grafana', 'jaeger', 'zipkin',
  'datadog', 'sentry', 'cloudwatch', 'logging', 'alert',
  'monitor', 'metric', 'tracing',
];

const CACHE_NAMES = ['redis', 'memcached', 'cache'];

export function classifyEdge(
  sourceNode: RFNode,
  targetNode: RFNode,
  label: string = '',
  arrowType: string = 'arrow'
): EdgeSemantics {
  const cleanLabel = label.toLowerCase().trim();
  const sourceLabel = ((sourceNode.data?.label as string) || '').toLowerCase();
  const targetLabel = ((targetNode.data?.label as string) || '').toLowerCase();

  const sourceService = (sourceNode.data?.serviceType as string) || 'service';
  const targetService = (targetNode.data?.serviceType as string) || 'service';

  let syncAsync: 'sync' | 'async' = 'sync';
  if (
    arrowType === 'dotted' ||
    ASYNC_KEYWORDS.some(k => cleanLabel.includes(k))
  ) {
    syncAsync = 'async';
  }

  let protocol = 'HTTP';
  const protoMap = syncAsync === 'async' ? PROTOCOL_MAP_ASYNC : PROTOCOL_MAP_SYNC;
  for (const [key, value] of Object.entries(protoMap)) {
    if (cleanLabel.includes(key)) {
      protocol = value;
      break;
    }
  }
  if (protocol === 'HTTP' && targetService === 'database') {
    protocol = 'SQL/TCP';
  }

  let importance: EdgeSemantics['importance'] = 'secondary';

  const isObservability = (svc: string, lbl: string) =>
    OBSERVABILITY_NAMES.some(k => svc.includes(k) || lbl.includes(k));

  const isCache = (svc: string, lbl: string) =>
    CACHE_NAMES.some(k => svc.includes(k) || lbl.includes(k));

  const isResponse = RESPONSE_LABEL_KEYWORDS.some(k => cleanLabel.includes(k));

  if (isObservability(sourceService, sourceLabel) || isObservability(targetService, targetLabel)) {
    importance = 'diagnostic';
  } else if (isResponse) {
    importance = 'diagnostic';
  } else if (
    (sourceService === 'client' && targetService === 'load-balancer') ||
    (sourceService === 'client' && targetService === 'service') ||
    (sourceService === 'load-balancer' && targetService === 'service') ||
    (sourceService === 'service' && targetService === 'database' && !isCache(targetService, targetLabel))
  ) {
    importance = 'primary';
  } else if (
    isCache(sourceService, sourceLabel) ||
    isCache(targetService, targetLabel) ||
    sourceService === 'queue' ||
    targetService === 'queue' ||
    sourceService === 'external-service' ||
    targetService === 'external-service'
  ) {
    importance = 'supporting';
  }

  if (
    cleanLabel.includes('retry') ||
    cleanLabel.includes('fallback') ||
    cleanLabel.includes('optional') ||
    cleanLabel.includes('health')
  ) {
    importance = 'optional';
  }

  let portType: EdgeSemantics['portType'] = 'outbound';
  if (targetService === 'database') {
    portType = 'storage';
  } else if (targetService === 'observability') {
    portType = 'observability';
  } else if (targetService === 'queue') {
    portType = 'events';
  } else if (cleanLabel.includes('control') || cleanLabel.includes('admin')) {
    portType = 'control';
  } else if (cleanLabel.includes('sec') || cleanLabel.includes('auth')) {
    portType = 'security';
  } else if (isResponse) {
    portType = 'outbound';
  }

  return {
    importance,
    syncAsync,
    portType,
    protocol,
  };
}
