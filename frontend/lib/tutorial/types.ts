/** @deprecated All 22 tutorials use schema.ts + builder.ts. Do not use. */
import type { Node, Edge } from 'reactflow';

// ──────────────────────────────────────────────────────────────────────────────
// Core Types
// ──────────────────────────────────────────────────────────────────────────────

export type ComponentType =
  | 'client'
  | 'cdn'
  | 'gateway'
  | 'load_balancer'
  | 'proxy'
  | 'service'
  | 'serverless'
  | 'worker'
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'search'
  | 'auth'
  | 'ai'
  | 'llm'
  | 'vector_db'
  | 'embedding'
  | 'rag'
  | 'observability'
  | 'logger'
  | 'metrics'
  | 'tracing'
  | 'external'
  | 'generic';

export interface ComponentMatcher {
  type?: ComponentType;
  category?: string;
  keywords?: string[];
  labelContains?: string[];
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  category: string;
  color: string;
  position: { x: number; y: number };
  componentId: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceComponentId: string;
  targetComponentId: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  getNodesByMatcher(matcher: ComponentMatcher): GraphNode[];
  hasNodesMatching(matcher: ComponentMatcher): boolean;
  countNodesMatching(matcher: ComponentMatcher): number;
  isConnected(from: ComponentMatcher, to: ComponentMatcher): boolean;
  hasEdge(from: ComponentMatcher, to: ComponentMatcher): boolean;
  getEdges(): GraphEdge[];
  getNodes(): GraphNode[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  hint?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export type ValidationFn = (graph: ArchitectureGraph) => ValidationResult;

// ──────────────────────────────────────────────────────────────────────────────
// Feedback
// ──────────────────────────────────────────────────────────────────────────────

export type FeedbackFn = (graph: ArchitectureGraph) => string[];

// ──────────────────────────────────────────────────────────────────────────────
// Action Intent
// ──────────────────────────────────────────────────────────────────────────────

export interface ActionIntent {
  type: 'ADD_NODE' | 'CONNECT' | 'DELETE_NODE' | 'MULTI';
  matcher?: ComponentMatcher;
  from?: ComponentMatcher;
  to?: ComponentMatcher;
  actions?: ActionIntent[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Tutorial Step
// ──────────────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string;
  order: number;
  title: string;
  description: string;
  explanation: string;
  why: string;
  
  action: ActionIntent;
  validation: ValidationFn;
  feedback: FeedbackFn;
  
  successMessage: string;
  hints: string[];
  
  openingMessage?: string;
  celebrationMessage?: string;
  connectingMessage?: string;
  messages?: string[];
  errorMessage?: string;
  contextMessage?: string;
  
  // GuidePanel compatibility
  requiredNodes?: string[];
  requiredEdges?: Array<{ from: string; to: string }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tutorial Level
// ──────────────────────────────────────────────────────────────────────────────

export interface TutorialLevel {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  estimatedTime: string;
  prerequisite?: string;
  unlocks?: string;
  contextMessage?: string;
  level?: number;
  stepCount?: number;
  steps: TutorialStep[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Tutorial
// ──────────────────────────────────────────────────────────────────────────────

export interface Tutorial {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert' | string;
  levels: TutorialLevel[];
  tags: string[];
  
  icon?: string;
  contextMessage?: string;
  category?: string;
  color?: string;
  estimatedTime?: string;
  unlocks?: string;
}

export type TutorialMessage = string;
export type StepValidation = ValidationResult;
export type EdgeRequirement = { from: string; to: string };

// ──────────────────────────────────────────────────────────────────────────────
// State Machine
// ──────────────────────────────────────────────────────────────────────────────

export type TutorialStatus = 
  | 'idle'
  | 'starting'
  | 'in_progress'
  | 'step_complete'
  | 'level_complete'
  | 'completed'
  | 'paused'
  | 'error';

export interface TutorialState {
  tutorialId: string | null;
  levelId: string | null;
  currentStepIndex: number;
  status: TutorialStatus;
  errors: ValidationError[];
  hintsShown: number;
  startedAt: number | null;
  completedAt: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Events
// ──────────────────────────────────────────────────────────────────────────────

export type CanvasEventType =
  | 'node_added'
  | 'node_deleted'
  | 'node_updated'
  | 'edge_created'
  | 'edge_deleted'
  | 'selection_changed'
  | 'canvas_cleared';

export interface CanvasEvent {
  type: CanvasEventType;
  timestamp: number;
  payload: unknown;
}

export type EventHandler = (event: CanvasEvent, state: TutorialState) => TutorialState | void;

// ──────────────────────────────────────────────────────────────────────────────
// Component Registry
// ──────────────────────────────────────────────────────────────────────────────

export interface ComponentDefinition {
  id: string;
  label: string;
  category: string;
  color: string;
  icon?: string;
  matcher: ComponentMatcher;
}

export interface ComponentRegistry {
  register(definition: ComponentDefinition): void;
  get(id: string): ComponentDefinition | undefined;
  getAll(): ComponentDefinition[];
  matches(component: GraphNode, matcher: ComponentMatcher): boolean;
}
