/** @deprecated All 22 tutorials use schema.ts + builder.ts. Do not use. */
import type {
  Tutorial,
  TutorialLevel,
  TutorialStep,
  ComponentMatcher,
  ValidationFn,
  FeedbackFn,
  ActionIntent,
} from './types';

import {
  createMatcher,
  nodeMatcher,
  clientMatcher,
  cdnMatcher,
  gatewayMatcher,
  loadBalancerMatcher,
  serviceMatcher,
  databaseMatcher,
  cacheMatcher,
  queueMatcher,
  llmMatcher,
  authMatcher,
  vectorDbMatcher,
  embeddingMatcher,
  ragMatcher,
  observabilityMatcher,
} from './graph';

import {
  addNodeValidation,
  connectValidation,
  nodeAndConnectionValidation,
  hasNode,
  hasConnection,
} from './validation';

import {
  nodeNotAddedFeedback,
  notConnectedFeedback,
  nodeAddedFeedback,
  progressiveFeedback,
  genericFeedback,
} from './feedback';

export {
  createMatcher,
  nodeMatcher,
  clientMatcher,
  cdnMatcher,
  gatewayMatcher,
  loadBalancerMatcher,
  serviceMatcher,
  databaseMatcher,
  cacheMatcher,
  queueMatcher,
  llmMatcher,
  authMatcher,
  vectorDbMatcher,
  embeddingMatcher,
  ragMatcher,
  observabilityMatcher,
};

export interface StepConfig {
  id: string;
  order: number;
  title: string;
  description: string;
  explanation: string;
  why: string;
  
  nodeMatcher: ComponentMatcher;
  fromMatchers?: ComponentMatcher[];
  toMatchers?: ComponentMatcher[];
  
  successMessage: string;
  hints: string[];
  
  openingMessage?: string;
  celebrationMessage?: string;
  connectingMessage?: string;
  messages?: string[];
  errorMessage?: string;
  contextMessage?: string;
}

export function createStep(config: StepConfig): TutorialStep {
  const fromMatchers = config.fromMatchers || [];
  const toMatchers = config.toMatchers || [];

  let validation: ValidationFn;
  let feedback: FeedbackFn;

  if (fromMatchers.length === 0 && toMatchers.length === 0) {
    validation = addNodeValidation(config.nodeMatcher);
    feedback = nodeNotAddedFeedback(config.nodeMatcher);
  } else if (fromMatchers.length === 0) {
    const to = toMatchers[0];
    validation = (graph) => {
      if (!hasNode(graph, config.nodeMatcher)) {
        return addNodeValidation(config.nodeMatcher)(graph);
      }
      const connections = toMatchers.map(t => ({
        from: config.nodeMatcher,
        to: t,
      }));
      return nodeAndConnectionValidation(config.nodeMatcher, undefined, to)(graph);
    };
    feedback = (graph) => {
      if (!hasNode(graph, config.nodeMatcher)) {
        return nodeNotAddedFeedback(config.nodeMatcher)(graph);
      }
      for (const to of toMatchers) {
        if (!hasConnection(graph, config.nodeMatcher, to)) {
          return notConnectedFeedback(config.nodeMatcher, to)(graph);
        }
      }
      return [];
    };
  } else if (toMatchers.length === 0) {
    const from = fromMatchers[0];
    validation = (graph) => {
      if (!hasNode(graph, config.nodeMatcher)) {
        return addNodeValidation(config.nodeMatcher)(graph);
      }
      return nodeAndConnectionValidation(config.nodeMatcher, from, undefined)(graph);
    };
    feedback = (graph) => {
      if (!hasNode(graph, config.nodeMatcher)) {
        return nodeNotAddedFeedback(config.nodeMatcher)(graph);
      }
      if (!hasConnection(graph, from, config.nodeMatcher)) {
        return notConnectedFeedback(from, config.nodeMatcher)(graph);
      }
      return [];
    };
  } else {
    const connections = [
      ...fromMatchers.map(from => ({ from, to: config.nodeMatcher })),
      ...toMatchers.map(to => ({ from: config.nodeMatcher, to })),
    ];
    
    validation = (graph) => {
      if (!hasNode(graph, config.nodeMatcher)) {
        return addNodeValidation(config.nodeMatcher)(graph);
      }
      
      for (const conn of connections) {
        if (!hasConnection(graph, conn.from, conn.to)) {
          return connectValidation(conn.from, conn.to)(graph);
        }
      }
      
      return { isValid: true, errors: [] };
    };
    
    feedback = progressiveFeedback([
      { matcher: config.nodeMatcher, connections },
    ]);
  }

  const action: ActionIntent = {
    type: 'MULTI',
    actions: [
      { type: 'ADD_NODE', matcher: config.nodeMatcher },
      ...fromMatchers.map(from => ({ type: 'CONNECT' as const, from, to: config.nodeMatcher })),
      ...toMatchers.map(to => ({ type: 'CONNECT' as const, from: config.nodeMatcher, to })),
    ],
  };

  // Compute requiredNodes and requiredEdges for GuidePanel compatibility
  // Extract meaningful identifiers from matchers for GuidePanel's string-based matching
  const requiredNodes: string[] = [];
  
  // Use labelContains for matching (most specific)
  if (config.nodeMatcher.labelContains && config.nodeMatcher.labelContains.length > 0) {
    requiredNodes.push(...config.nodeMatcher.labelContains);
  }
  // Fall back to keywords
  if (config.nodeMatcher.keywords && config.nodeMatcher.keywords.length > 0) {
    requiredNodes.push(...config.nodeMatcher.keywords);
  }
  // Fall back to category
  if (config.nodeMatcher.category) {
    requiredNodes.push(config.nodeMatcher.category);
  }

  const requiredEdges: Array<{ from: string; to: string }> = [];
  
  for (const fromMatcher of fromMatchers) {
    const fromId = fromMatcher.labelContains?.[0] || fromMatcher.keywords?.[0] || fromMatcher.category || 'source';
    const toId = config.nodeMatcher.labelContains?.[0] || config.nodeMatcher.keywords?.[0] || config.nodeMatcher.category || 'target';
    requiredEdges.push({ from: fromId, to: toId });
  }
  
  for (const toMatcher of toMatchers) {
    const fromId = config.nodeMatcher.labelContains?.[0] || config.nodeMatcher.keywords?.[0] || config.nodeMatcher.category || 'source';
    const toId = toMatcher.labelContains?.[0] || toMatcher.keywords?.[0] || toMatcher.category || 'target';
    requiredEdges.push({ from: fromId, to: toId });
  }

  return {
    id: config.id,
    order: config.order,
    title: config.title,
    description: config.description,
    explanation: config.explanation,
    why: config.why,
    action,
    validation,
    feedback,
    successMessage: config.successMessage,
    hints: config.hints,
    openingMessage: config.openingMessage,
    celebrationMessage: config.celebrationMessage,
    connectingMessage: config.connectingMessage,
    messages: config.messages,
    errorMessage: config.errorMessage,
    contextMessage: config.contextMessage,
    // GuidePanel compatibility
    requiredNodes,
    requiredEdges,
  };
}

export interface LevelConfig {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  estimatedTime: string;
  prerequisite?: string;
  unlocks?: string;
  contextMessage?: string;
  steps: TutorialStep[];
}

export function createLevel(config: LevelConfig): TutorialLevel {
  return {
    id: config.id,
    order: config.order,
    level: config.order,
    title: config.title,
    subtitle: config.subtitle,
    description: config.description,
    estimatedTime: config.estimatedTime,
    prerequisite: config.prerequisite,
    unlocks: config.unlocks,
    contextMessage: config.contextMessage,
    steps: config.steps.sort((a, b) => a.order - b.order),
  };
}

export interface TutorialConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: Tutorial['difficulty'];
  tags: string[];
  levels: TutorialLevel[];
  contextMessage?: string;
  category?: string;
  color?: string;
  estimatedTime?: string;
  unlocks?: string;
  difficultyLabel?: string;
}

export function createTutorial(config: TutorialConfig): Tutorial {
  return {
    id: config.id,
    title: config.title,
    subtitle: config.subtitle,
    description: config.description,
    difficulty: config.difficulty,
    tags: config.tags,
    levels: config.levels.sort((a, b) => a.order - b.order),
    contextMessage: config.contextMessage,
    category: config.category,
    color: config.color,
    estimatedTime: config.estimatedTime,
    unlocks: config.unlocks,
  };
}

export { createMatcher as matcher };

export function hint(text: string): string {
  return text;
}

export function success(text: string): string {
  return text;
}

export function step(config: {
  id: string | number;
  title: string;
  explanation?: string;
  action?: string | ActionIntent;
  why?: string;
  component?: ComponentMatcher;
  requiredNodes?: string[];
  requiredEdges?: { from: string; to: string }[];
  successMessage?: string;
  errorMessage?: string;
  openingMessage?: string;
  celebrationMessage?: string;
  connectingMessage?: string;
  messages?: string[];
  description?: string;
}): TutorialStep {
  const actionIntent: ActionIntent = typeof config.action === 'string'
    ? { type: 'ADD_NODE', matcher: config.component }
    : config.action || { type: 'ADD_NODE' };

  const stepConfig: StepConfig = {
    id: String(config.id),
    order: typeof config.id === 'number' ? config.id : 1,
    title: config.title,
    description: config.description || config.explanation || '',
    explanation: config.explanation || config.description || '',
    why: config.why || '',
    nodeMatcher: config.component || { category: 'generic' },
    successMessage: config.successMessage || '',
    hints: config.messages || [],
    openingMessage: config.openingMessage,
    celebrationMessage: config.celebrationMessage,
    connectingMessage: config.connectingMessage,
    messages: config.messages,
    errorMessage: config.errorMessage,
  };

  return createStep(stepConfig);
}

export function level(config: {
  level?: number;
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  estimatedTime: string;
  unlocks?: string;
  prerequisite?: string;
  contextMessage?: string;
  steps: TutorialStep[];
}): TutorialLevel {
  return createLevel({
    id: config.id || `level-${config.level || 1}`,
    order: config.level || 1,
    title: config.title,
    subtitle: config.subtitle,
    description: config.description,
    estimatedTime: config.estimatedTime,
    unlocks: config.unlocks,
    prerequisite: config.prerequisite,
    contextMessage: config.contextMessage,
    steps: config.steps,
  });
}

export function tutorial(config: {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  difficulty: Tutorial['difficulty'];
  contextMessage?: string;
  levels: TutorialLevel[];
  category?: string;
  color?: string;
  estimatedTime?: string;
  unlocks?: string;
  difficultyLabel?: string;
  icon?: string;
  nodeCount?: number;
  stepCount?: number;
  isLive?: boolean;
  tags?: string[];
  [key: string]: unknown;
}): Tutorial {
  return createTutorial({
    id: config.id,
    title: config.title,
    subtitle: config.subtitle || config.description || '',
    description: config.description || config.subtitle || config.title,
    difficulty: config.difficulty,
    tags: config.tags || [],
    levels: config.levels,
    contextMessage: config.contextMessage,
    category: config.category,
    color: config.color,
    estimatedTime: config.estimatedTime,
    unlocks: config.unlocks,
  });
}

export function component(id: string, label: string, displayName?: string): ComponentMatcher {
  return createMatcher({
    category: label,
    labelContains: [displayName || label],
  });
}

export function edge(source: string, target: string): { from: string; to: string } {
  return {
    from: source,
    to: target,
  };
}

export function msg(text: string): string {
  return text;
}

export const EDGE_LABEL: Record<string, string> = {
  client_mobile: 'Mobile',
  client_web: 'Web',
  cdn: 'CDN',
  api_gateway: 'API Gateway',
  load_balancer: 'Load Balancer',
  microservice: 'Microservice',
  llm_api: 'LLM API',
  nosql_db: 'NoSQL Database',
  auth_service: 'Auth Service',
  sql_db: 'SQL Database',
  in_memory_cache: 'In-Memory Cache',
  embedding_service: 'Embedding Service',
  vector_db: 'Vector Database',
  rag_pipeline: 'RAG Pipeline',
  message_queue: 'Message Queue',
  logger: 'Logger',
  metrics_collector: 'Metrics Collector',
  dashboard: 'Dashboard',
  bff_gateway: 'BFF Gateway',
  serverless_fn: 'Serverless Function',
  token_bucket_rate_limiter: 'Token Bucket Rate Limiter',
  otel_collector: 'OpenTelemetry Collector',
};
