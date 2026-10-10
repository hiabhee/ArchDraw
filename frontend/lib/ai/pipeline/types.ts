import type { ServiceType, LayerType } from '../types';

// Pipeline internal types

export type PipelineLayer = LayerType;

export interface RawNode {
  id: string;
  label: string;
  subtitle?: string;
  layer: PipelineLayer;
  icon?: string;
  serviceType?: ServiceType;
  isGroup?: boolean;
  groupLabel?: string;
  groupColor?: string;
  parentId?: string;
}

export interface RawFlow {
  path: string[];
  label?: string;
  async: boolean;
  communicationType?: string;
  edgeVariant?: string;
}

export interface ParsedDiagram {
  nodes: RawNode[];
  flows: RawFlow[];
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  async: boolean;
  communicationType?: string;
  edgeVariant?: string;
}

export interface ValidatedDiagram {
  nodes: RawNode[];
  edges: DiagramEdge[];
}

export interface LayoutedNode extends RawNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IntentResult {
  type: string;
  confidence: number;
  ambiguous: boolean;
}

export interface PreGenerationChecklist {
  humanActors: string[];
  dataStores: string[];
  backgroundJobs: string[];
  externalIntegrations: string[];
  featureRequirements: string[];
}

export interface ReasoningResult {
  systemType: string;
  sourcePrompt?: string;
  nfrs: Record<string, string>;
  capPosition: string;
  boundaries: {
    entryPoints: string[];
    exitPoints: string[];
    trustZones: string[];
  };
  layerAssignment: Record<string, string>;
  patterns: { pattern: string; justification: string }[];
  stressTests: { scenario: string; outcome: string; safe: boolean; mitigation: string }[];
  keyDecisions: string[];
  // NEW: Structured architectural plan
  layers?: Record<string, { description: string; components: string[] }>;
  keyFlows?: Array<{ name: string; description: string; path: string[] }>;
  architecturalPlan?: string;
  extractedBehaviors?: string[];
  preGenerationChecklist?: PreGenerationChecklist;
}

export interface DiagramScore {
  geometry?: ReturnType<typeof import('@/lib/pipeline-shared/layout/layoutQuality').measureLayoutQuality>;
  grade: 'A' | 'B' | 'C' | 'F';
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  hasGroups?: boolean;
  score: number;
  // Preservation metrics
  nodesRemoved?: number;
  edgesRemoved?: number;
  groupsRemoved?: number;
  preservationPenalty?: number;
}

export interface ValidationIssue {
  severity: 'critical' | 'warning';
  type: string;
  nodeId?: string;
  message: string;
}

export interface ValidationFeedback {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  injectedNodes: string[];
  prunedNodes: string[];
  orphansFixed: number;
  tiersRepaired: string[];
}

// ── Custom-first pipeline types ──────────────────────────────────────────────

export type ArchitectureStyle =
  | 'monolith'
  | 'modular_monolith'
  | 'microservices'
  | 'mvc'
  | 'event_driven'
  | 'data_pipeline'
  | 'serverless'
  | 'ml'
  | 'saas'
  | 'enterprise'
  | 'mobile_backend'
  | 'iot'
  | 'realtime_collab'
  | 'generic';

export type ProductionDepth = 'conceptual' | 'application' | 'production';

export interface ArchitectureStylePlan {
  /** Detected or inferred architecture style */
  style: ArchitectureStyle;
  /** Whether style was explicitly stated or inferred from prompt keywords */
  strictness: 'explicit' | 'inferred';
  /** How deeply the user wants production-hardening components */
  productionDepth: ProductionDepth;
}

export interface PipelineDiagnostics {
  qualityRepair?: { attempted: boolean; accepted: boolean };
  style: ArchitectureStyle;
  productionDepth: ProductionDepth;
  /** Warnings / info about architectural issues — diagnostic only, no mutations */
  semanticIssues: ValidationIssue[];
  /** Low-level structural repairs (ID dedup, icon fill, dangling edge removal) */
  mechanicalRepairs: ValidationIssue[];
  /** Edge IDs that were dropped because they referenced non-existent nodes */
  removedInvalidEdgeIds: string[];
  /** True when semantic auto-injection was intentionally skipped */
  rejectedAutoInjection: boolean;
  /** Existing diagram node IDs dropped by the model (not re-injected during validation) */
  removedExistingNodeIds?: string[];
}
