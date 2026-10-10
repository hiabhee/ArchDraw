export type LayerType = 
  | 'client' 
  | 'edge' 
  | 'compute' 
  | 'async' 
  | 'data' 
  | 'observe' 
  | 'external' 
  | 'group';

export type TierType = 
  | 'client' 
  | 'edge' 
  | 'compute' 
  | 'async' 
  | 'data' 
  | 'observe' 
  | 'external';

export type CommunicationType = 'sync' | 'async' | 'stream' | 'event' | 'dep';
export type PathType = 'smooth' | 'bezier' | 'step' | 'straight';
export type HandlePosition = 'right' | 'left' | 'top' | 'bottom';
export type MarkerType = 'arrowclosed' | 'arrow' | 'none';
export type EdgeVariant = 'solid' | 'dashed' | 'dotted';

export interface ArchitectureNode {
  id: string;
  type: string;
  label: string;
  subtitle?: string;
  layer: LayerType;
  tier?: TierType;
  tierColor?: string;
  accentColor?: string;
  groupColor?: string;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  shape?: string;
  position?: { x: number; y: number };
  width: number;
  height: number;
  icon: string;
  metadata: Record<string, unknown>;
  layerIndex?: number;
  isGroup?: boolean;
  parentId?: string;
  groupLabel?: string;
  serviceType?: string;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandlePosition;
  targetHandle?: HandlePosition;
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
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: string;
    layer: LayerType;
    tier?: TierType;
    tierColor?: string;
    accentColor?: string;
    subtitle?: string;
    serviceType?: string;
    isGroup?: boolean;
    parentId?: string;
    groupLabel?: string;
    groupColor?: string;
    status?: 'healthy' | 'warning' | 'error' | 'unknown';
    shape?: string;
  };
  width?: number;
  height?: number;
  zIndex?: number;
  extent?: 'parent';
  style?: Record<string, unknown>;
  parentNode?: string;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandlePosition;
  targetHandle?: HandlePosition;
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
    labelDetailed?: string;
    edgeVariant?: EdgeVariant;
    edgeType?: CommunicationType;
  };
}

export interface DiagramResult {
  success: boolean;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  elkPositions: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    layoutAlgorithm: string;
    direction: string;
  };
  diagramUrl?: string;
  sessionId?: string;
  message?: string;
  errors?: string[];
}

export interface ComponentDefinition {
  id: string;
  label: string;
  category: string;
  color: string;
  icon: string;
  description: string;
}

export interface UserIntent {
  description: string;
  systemType: string;
  complexity: 'low' | 'medium' | 'high';
  model?: string;
}

export interface GenerationProgress {
  phase: 'planning' | 'components' | 'layout' | 'edges' | 'validating' | 'scoring' | 'complete' | 'error';
  iteration: number;
  currentAgent: string;
  score: number;
  message: string;
  progress: number;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface NodeTypeSummary {
  categories: Array<{
    name: string;
    count: number;
    nodes: Array<{
      id: string;
      label: string;
      icon: string;
      description: string;
    }>;
  }>;
  totalCount: number;
}
