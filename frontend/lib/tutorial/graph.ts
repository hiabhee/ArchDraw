/** @deprecated All 22 tutorials use schema.ts + builder.ts. Do not use. */
import type { Node, Edge } from 'reactflow';
import type { 
  ArchitectureGraph, 
  GraphNode, 
  GraphEdge, 
  ComponentMatcher,
  ComponentType,
  ComponentDefinition 
} from './types';
import type { ArchitectureGraph as AG } from './types';
export type { ArchitectureGraph, GraphNode, GraphEdge, ComponentMatcher, ComponentType };
import { CORE_COMPONENTS as componentsData } from '@/lib/componentRegistry';

const TYPE_KEYWORDS: Record<ComponentType, string[]> = {
  client: ['client', 'web', 'mobile', 'browser', 'app'],
  cdn: ['cdn', 'edge', 'content delivery'],
  gateway: ['gateway', 'api gateway', 'bff'],
  load_balancer: ['load balancer', 'loadbalancer', 'lb'],
  proxy: ['proxy', 'reverse proxy', 'nginx'],
  service: ['service', 'microservice', 'server', 'backend'],
  serverless: ['serverless', 'function', 'lambda', 'fn'],
  worker: ['worker', 'job', 'background', 'cron'],
  database: ['database', 'db', 'sql', 'postgres', 'mysql', 'mongodb', 'nosql', 'dynamodb'],
  cache: ['cache', 'redis', 'memcached', 'memory'],
  queue: ['queue', 'message queue', 'kafka', 'rabbitmq', 'event bus', 'pubsub'],
  storage: ['storage', 's3', 'blob', 'file'],
  search: ['search', 'elasticsearch', 'opensearch', 'algolia'],
  auth: ['auth', 'authentication', 'jwt', 'oauth', 'cognito', 'clerk', 'auth0'],
  ai: ['ai', 'llm', 'openai', 'anthropic', 'claude', 'gpt', 'gemini'],
  llm: ['llm', 'openai', 'anthropic', 'claude', 'gpt', 'gemini'],
  vector_db: ['vector', 'pinecone', 'weaviate', 'chroma', 'embedding'],
  embedding: ['embedding', 'text-embedding', 'vectorize'],
  rag: ['rag', 'retrieval', 'augmented'],
  observability: ['observability', 'monitoring'],
  logger: ['logger', 'logging', 'log', 'elk', 'loki'],
  metrics: ['metrics', 'prometheus', 'grafana', 'datadog'],
  tracing: ['tracing', 'jaeger', 'zipkin', 'opentelemetry', 'otel'],
  external: ['external', 'third party', 'stripe', 'twilio', 'sendgrid', 'fcm'],
  generic: [],
};

export function matchType(category: string, label: string): ComponentType {
  const text = `${category} ${label}`.toLowerCase();
  
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return type as ComponentType;
      }
    }
  }
  
  return 'generic';
}

export function matchesMatcher(node: GraphNode | { label: string; category: string; componentId?: string }, matcher: ComponentMatcher): boolean {
  if (matcher.category) {
    const cat = node.category.toLowerCase();
    if (!cat.includes(matcher.category.toLowerCase())) {
      return false;
    }
  }

  if (matcher.keywords && matcher.keywords.length > 0) {
    const text = `${node.label} ${node.category}`.toLowerCase();
    const hasKeyword = matcher.keywords.some(kw => 
      text.includes(kw.toLowerCase())
    );
    if (!hasKeyword) {
      return false;
    }
  }

  if (matcher.labelContains && matcher.labelContains.length > 0) {
    const label = node.label.toLowerCase();
    const hasLabel = matcher.labelContains.some(lc => 
      label.includes(lc.toLowerCase())
    );
    if (!hasLabel) {
      return false;
    }
  }

  if (matcher.type) {
    const nodeType = matchType(node.category, node.label);
    if (nodeType !== matcher.type) {
      return false;
    }
  }

  return true;
}

export function createGraph(nodes: Node[], edges: Edge[]): ArchitectureGraph {
  const graphNodes: GraphNode[] = nodes.map(n => ({
    id: n.id,
    type: n.type || 'systemNode',
    label: n.data?.label || n.id,
    category: n.data?.category || 'Unknown',
    color: n.data?.color || '#6B7280',
    position: n.position,
    componentId: n.data?.componentId || n.id,
  }));

  const graphEdges: GraphEdge[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceComponentId: (nodes.find(n => n.id === e.source)?.data?.componentId || e.source),
    targetComponentId: (nodes.find(n => n.id === e.target)?.data?.componentId || e.target),
  }));

  return {
    nodes: graphNodes,
    edges: graphEdges,
    
    getNodesByMatcher(matcher: ComponentMatcher): GraphNode[] {
      return this.nodes.filter(n => matchesMatcher(n, matcher));
    },
    
    hasNodesMatching(matcher: ComponentMatcher): boolean {
      return this.nodes.some(n => matchesMatcher(n, matcher));
    },
    
    countNodesMatching(matcher: ComponentMatcher): number {
      return this.nodes.filter(n => matchesMatcher(n, matcher)).length;
    },
    
    isConnected(from: ComponentMatcher, to: ComponentMatcher): boolean {
      const fromNodes = this.getNodesByMatcher(from);
      const toNodes = this.getNodesByMatcher(to);
      
      for (const fromNode of fromNodes) {
        for (const toNode of toNodes) {
          if (this.edges.some(e => e.source === fromNode.id && e.target === toNode.id)) {
            return true;
          }
        }
      }
      return false;
    },
    
    hasEdge(from: ComponentMatcher, to: ComponentMatcher): boolean {
      return this.isConnected(from, to);
    },
    
    getEdges(): GraphEdge[] {
      return this.edges;
    },
    
    getNodes(): GraphNode[] {
      return this.nodes;
    },
  };
}

export function createMatcher(config: {
  type?: ComponentType;
  category?: string;
  keywords?: string[];
  labelContains?: string[];
}): ComponentMatcher {
  return config;
}

export function nodeMatcher(type: string, label?: string): ComponentMatcher {
  return createMatcher({
    category: type,
    ...(label ? { labelContains: [label] } : {}),
  });
}

export function clientMatcher(subtype?: 'web' | 'mobile'): ComponentMatcher {
  if (subtype === 'web') {
    return createMatcher({ category: 'Client', labelContains: ['Web', 'Browser'] });
  }
  if (subtype === 'mobile') {
    return createMatcher({ category: 'Client', labelContains: ['Mobile', 'iOS', 'Android'] });
  }
  return createMatcher({ category: 'Client' });
}

export function cdnMatcher(): ComponentMatcher {
  return createMatcher({ category: 'Client', labelContains: ['CDN', 'Edge'] });
}

export function gatewayMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['gateway', 'api gateway'] });
}

export function loadBalancerMatcher(): ComponentMatcher {
  return createMatcher({ labelContains: ['Load Balancer', 'LoadBalancer'] });
}

export function serviceMatcher(name?: string): ComponentMatcher {
  return createMatcher({
    category: 'Compute',
    ...(name ? { labelContains: [name] } : {}),
  });
}

export function databaseMatcher(type?: 'sql' | 'nosql'): ComponentMatcher {
  if (type === 'sql') {
    return createMatcher({ keywords: ['sql', 'postgres', 'mysql', 'postgresql'] });
  }
  if (type === 'nosql') {
    return createMatcher({ keywords: ['nosql', 'mongodb', 'dynamodb', 'cassandra'] });
  }
  return createMatcher({ keywords: ['database', 'sql', 'nosql'] });
}

export function cacheMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['cache', 'redis', 'memcached'] });
}

export function queueMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['queue', 'kafka', 'rabbitmq', 'message'] });
}

export function llmMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['llm', 'openai', 'anthropic', 'claude', 'gpt', 'ai'] });
}

export function authMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['auth', 'oauth', 'jwt', 'authentication'] });
}

export function vectorDbMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['vector', 'pinecone', 'weaviate'] });
}

export function embeddingMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['embedding', 'text-embedding'] });
}

export function ragMatcher(): ComponentMatcher {
  return createMatcher({ keywords: ['rag', 'retrieval'] });
}

export function observabilityMatcher(type?: 'logger' | 'metrics' | 'tracing' | 'dashboard'): ComponentMatcher {
  if (type === 'logger') {
    return createMatcher({ keywords: ['log', 'logger', 'elk', 'loki'] });
  }
  if (type === 'metrics') {
    return createMatcher({ keywords: ['metrics', 'prometheus', 'grafana'] });
  }
  if (type === 'tracing') {
    return createMatcher({ keywords: ['tracing', 'jaeger', 'otel', 'opentelemetry'] });
  }
  if (type === 'dashboard') {
    return createMatcher({ labelContains: ['Dashboard', 'Grafana'] });
  }
  return createMatcher({ category: 'Observability' });
}
