export interface UserIntent {
  description: string;
  systemType: string;
  complexity: 'low' | 'medium' | 'high';
  model?: string;
  diagramSize?: 'small' | 'medium' | 'large';
  existingContext?: {
    nodes: unknown[];
    edges: unknown[];
  };
}

// ============================================================================
// ARCHITECTURE REASONING TYPES
// ============================================================================

export type ArchitectureLayer = 
  | 'presentation' 
  | 'gateway' 
  | 'application' 
  | 'orchestration' 
  | 'data' 
  | 'observability';

export interface NFRs {
  scale: string;
  latency: string;
  consistency: 'strong' | 'eventual';
  availability: string;
  faultTolerance: string;
}

export interface ArchitectureBoundaries {
  entryPoints: string[];
  exitPoints: string[];
  trustZones: string[];
}

export interface StressTestResult {
  scenario: string;
  outcome: string;
  safe: boolean;
  mitigation?: string;
}

export interface PatternSelection {
  pattern: string;
  justification: string;
}

export interface ArchitectureThinking {
  systemType: string;
  nfrs: NFRs;
  capPosition: 'CP' | 'AP';
  actors: string[];
  boundaries: ArchitectureBoundaries;
  layerAssignment: Record<string, ArchitectureLayer>;
  patterns: PatternSelection[];
  stressTests: StressTestResult[];
  keyDecisions: string[];
}

export interface DesignDocument {
  thinking: ArchitectureThinking;
  diagram: {
    nodes: ArchitectureNode[];
    flows: string[][];
  };
  generatedAt: string;
}

export interface ArchitectureNode {
  id: string;
  type: string;
  label: string;
  layer: LayerType;
  position?: { x: number; y: number };
  width: number;
  height: number;
  icon: string;
  metadata: Record<string, unknown>;
  
  // LAYER INDEX (1-5 for ELK positioning)
  layerIndex?: number;
  
  // GROUP / CONTAINER FIELDS
  isGroup?: boolean;
  parentId?: string;
  groupLabel?: string;
  groupColor?: string;
  
  // SERVICE TYPE FIELD
  serviceType?: ServiceType;
  
  // TIER SYSTEM (new layout rules)
  tier?: 'edge' | 'compute' | 'async' | 'data' | 'observe' | 'client' | 'external' | 'infrastructure';
  tierColor?: string;
  subtitle?: string;
  
  // TECH FIELD (specific technology)
  tech?: string;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  isExternal?: boolean;
  hideTierTag?: boolean;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: HandlePosition;
  targetHandle: HandlePosition;
  communicationType: CommunicationType;
  pathType: PathType;
  label: string;
  labelPosition: 'center';
  animated: boolean;
  style: {
    stroke: string;
    strokeDasharray: string;
    strokeWidth: number;
  };
  markerEnd: MarkerType;
  markerStart: MarkerType;
  edgeVariant?: EdgeVariant;
  importance?: 'primary' | 'secondary' | 'supporting' | 'diagnostic' | 'optional';
  syncAsync?: 'sync' | 'async';
  portType?: 'inbound' | 'outbound' | 'control' | 'data' | 'events' | 'storage' | 'runtime' | 'external' | 'observability' | 'security';
  protocol?: string;
  isBundle?: boolean;
  bundledEdges?: ArchitectureEdge[];
}

export interface LayoutConfig {
  algorithm: 'layered' | 'force';
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  elkOptions: Record<string, string>;
  layerOrder: LayerType[];
  totalWidth: number;
  totalHeight: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  nodeId: string | null;
  edgeId: string | null;
  description: string;
  fixHint: string;
}

export interface AgentHistory {
  agent: string;
  timestamp: number;
  action: string;
  result?: unknown;
}

export interface SharedState {
  userIntent: UserIntent;
  components: ArchitectureNode[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  layout: LayoutConfig;
  layoutHints: LayoutHints;
  issues: ValidationIssue[];
  score: number;
  iteration: number;
  history: AgentHistory[];
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: string;
    layer: LayerType;
    layerIndex?: number;
    isGroup?: boolean;
    parentId?: string;
    groupLabel?: string;
    groupColor?: string;
    serviceType?: ServiceType;
    tier?: string;
    tierColor?: string;
    subtitle?: string;
    tech?: string;
    status?: 'healthy' | 'warning' | 'error' | 'unknown';
    isExternal?: boolean;
    hideTierTag?: boolean;
  };
  width?: number;
  height?: number;
  measured?: {
    width: number;
    height: number;
  };
  zIndex?: number;
  extent?: 'parent';
  style?: Record<string, unknown>;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: HandlePosition;
  targetHandle: HandlePosition;
  type: string;
  animated: boolean;
  label: string;
  labelShowBg: boolean;
  labelBgPadding: [number, number];
  labelBgBorderRadius: number;
  labelBgStyle: { fill: string; fillOpacity?: number; stroke?: string };
  labelStyle: { fontSize: number; fontWeight: number; fill: string };
  style: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray: string;
  };
  markerEnd: { type: string; color: string };
  data: {
    communicationType: CommunicationType;
    pathType: PathType;
    label: string;
    edgeVariant?: 'solid' | 'dashed' | 'dotted' | 'feedback';
    labelX?: number;
    labelY?: number;
    labelAngle?: number;
    waypoints?: { x: number; y: number }[];
  };
}

export interface StressTestResult {
  scenario: string;
  outcome: string;
  safe: boolean;
}

export interface ArchitectureAnalysis {
  problemFraming?: string;
  boundaries?: {
    entryPoints?: string[];
    exitPoints?: string[];
    trustBoundaries?: string[];
  };
  layerAssignment?: Record<string, string>;
  patternSelections?: { pattern: string; justification: string }[];
  stressTestResults?: StressTestResult[];
}

export interface GenerationResult {
  type: 'architecture' | 'sequence';
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  metadata: {
    score?: number;
    grade?: 'A' | 'B' | 'C' | 'D';
    iterations?: number;
    totalNodes: number;
    totalEdges: number;
    systemType: string;
    generatedAt: string;
    analysis?: ArchitectureAnalysis | null;
    thinking?: ArchitectureThinking | null;
    complexityTier?: 'simple' | 'moderate' | 'complex';
    truncated?: boolean;
    droppedEdgeCount?: number;
    qualityWarnings?: string[];
    pipelineDiagnostics?: import('../pipeline/types').PipelineDiagnostics;
    edgeLayoutMetrics?: {
      pathOptimizationScore: number;
      labelPositioningScore: number;
      collisionsResolved: number;
      edgeCrossings: number;
      remainingLabelCollisions?: number;
    };
    layoutHints?: LayoutHints;
    title?: string;
    actors?: string[];
    mermaidSyntax?: string;
  };
}

export type LayerType = 
  | 'client' 
  | 'presentation'
  | 'edge' 
  | 'gateway'
  | 'compute' 
  | 'application'
  | 'async' 
  | 'queue'
  | 'data' 
  | 'observe' 
  | 'observability'
  | 'infrastructure'
  | 'external' 
  | 'group';

export type ServiceType = 
  | 'database'
  | 'cache'
  | 'queue'
  | 'api'
  | 'loadbalancer'
  | 'storage'
  | 'cdn'
  | 'auth'
  | 'compute'
  | 'monitor'
  | 'gateway'
  | 'client'
  | 'service'
  | 'generic';

export type CommunicationType = 'sync' | 'async' | 'stream' | 'event' | 'dep' | 'dotted';

export type PathType = 'smooth' | 'bezier' | 'step' | 'straight';

// Handle IDs used by our node handle components (`FloatingHandles`) and legacy layout.
// React Flow validates edges by matching these IDs, so keep this union in sync with node handle ids.
export type HandlePosition =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'right-top'
  | 'right-mid'
  | 'right-bot'
  | 'left-top'
  | 'left-mid'
  | 'left-bot'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'source-left'
  | 'source-right'
  | 'source-top'
  | 'source-bottom'
  | 'target-left'
  | 'target-right'
  | 'target-top'
  | 'target-bottom';

export type MarkerType = 'arrowclosed' | 'arrow' | 'none';

export type EdgeVariant = 'solid' | 'dashed' | 'dotted' | 'feedback';

export type AgentAction = 'component' | 'layout' | 'edges' | 'edge_fix' | 'validate' | 'stop';

export interface PlannerDecision {
  next_action: AgentAction;
  reasoning: string;
  priority_issues: string[];
}

export interface ValidationResult {
  pass: boolean;
  critical_issues: ValidationIssue[];
  summary: string;
}

export interface ScoreResult {
  score: number;
  breakdown: {
    layout_quality: number;
    edge_quality: number;
    intent_match: number;
    communication_accuracy: number;
    penalties: number;
  };
  verdict: 'stop' | 'continue_edges' | 'continue_layout' | 'restart';
  top_improvements: string[];
}

export interface GenerationProgress {
  phase: 'planning' | 'reasoning' | 'generating' | 'components' | 'layout' | 'edges' | 'validating' | 'scoring' | 'complete' | 'error';
  iteration: number;
  currentAgent: string;
  score: number;
  message: string;
  progress: number;
}

export interface PrimaryFlow {
  id: string;
  nodeIds: string[];
  flowType: 'request' | 'processing' | 'async' | 'response';
}

export interface ComponentGroup {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
}

export interface LayoutHints {
  primaryFlow: PrimaryFlow[];
  groups: ComponentGroup[];
  layers: Record<LayerType, { x: number; y: number }>;
}
