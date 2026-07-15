import { MarkerType, type Edge } from 'reactflow';

export type PathType = 'smooth' | 'Smoothstep' | 'bezier' | 'step' | 'straight';
export type EdgeType = 'sync' | 'async' | 'stream' | 'event' | 'dep' | 'dotted';
export type EdgePortSide = 'top' | 'right' | 'bottom' | 'left';

export interface EdgeTypeConfig {
  id: EdgeType;
  label: string;
  color: string;
  dash: string;
  animated: boolean;
  markerStart: boolean;
  markerEnd: boolean;
  pathType: PathType;
}

export const EDGE_TYPE_CONFIGS: Record<EdgeType, EdgeTypeConfig> = {
  sync: {
    id: 'sync',
    label: 'Sync',
    color: '#3B82F6',
    dash: '',
    animated: false,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
  async: {
    id: 'async',
    label: 'Async',
    color: '#F59E0B',
    dash: '8 6',
    animated: true,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
  stream: {
    id: 'stream',
    label: 'Stream',
    color: '#10B981',
    dash: '10 4 2 4',
    animated: true,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
  event: {
    id: 'event',
    label: 'Event',
    color: '#8B5CF6',
    dash: '4 4',
    animated: true,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
  dep: {
    id: 'dep',
    label: 'Dep',
    color: '#6B7280',
    dash: '6 6',
    animated: true,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
  dotted: {
    id: 'dotted',
    label: 'Dotted',
    color: '#94a3b8',
    dash: '2 4',
    animated: false,
    markerStart: false,
    markerEnd: true,
    pathType: 'Smoothstep',
  },
};

export const PATH_TYPE_DEFAULTS: Record<PathType, { borderRadius?: number }> = {
  smooth: { borderRadius: 24 },
  Smoothstep: { borderRadius: 50 },
  bezier: {},
  step: { borderRadius: 0 },
  straight: {},
};

export const DEFAULT_EDGE_TYPE: EdgeType = 'sync';

export interface EdgeData {
  label?: string;
  edgeType?: EdgeType;
  pathType?: PathType;
  edgeVariant?: 'solid' | 'dashed' | 'dotted' | 'feedback';
  hideLabel?: boolean;
  communicationType?: 'sync' | 'async' | 'stream' | 'event' | 'dep';
  connectionType?: EdgeType;
  color?: string;
  labelT?: number;
  sourceSide?: EdgePortSide;
  targetSide?: EdgePortSide;
  curvature?: number;
  async?: boolean;
  importance?: 'primary' | 'secondary' | 'supporting' | 'diagnostic' | 'optional';
  portType?: 'inbound' | 'outbound' | 'control' | 'data' | 'events' | 'storage' | 'runtime' | 'external' | 'observability' | 'security';
  protocol?: string;
  syncAsync?: 'sync' | 'async';
  responseLabel?: string;
  responseEdgeId?: string;
  isReturn?: boolean;
  isSpine?: boolean;
  isBundle?: boolean;
  bundledEdges?: Edge[];
  customWaypoints?: Array<{ x: number; y: number }>;
}

export function getEdgeConfig(edgeType: EdgeType | undefined): EdgeTypeConfig {
  if (!edgeType || !EDGE_TYPE_CONFIGS[edgeType]) {
    return EDGE_TYPE_CONFIGS[DEFAULT_EDGE_TYPE];
  }
  return EDGE_TYPE_CONFIGS[edgeType];
}

export function getEffectivePathType(edgeType: EdgeType | undefined, pathType: PathType | undefined): PathType {
  if (pathType) return pathType;
  return getEdgeConfig(edgeType).pathType;
}
