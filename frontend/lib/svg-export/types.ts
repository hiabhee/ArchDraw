import type { Edge } from 'reactflow';
import type { NodeData } from '@/store/diagram/types';
import type { EdgeData } from '@/data/edgeTypes';
import { Position } from '@/lib/utils/edgePositions';

export interface TextLabelNodeData extends NodeData {
  text?: string;
  fontSize?: string;
  bold?: boolean;
}

export interface AnnotationNodeData extends NodeData {
  title?: string;
  body?: string;
  titleSize?: string;
  titleBold?: boolean;
  bodySize?: string;
  bodyBold?: boolean;
}

export interface SystemNodeRenderData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: NodeData;
  selected?: boolean;
}

export interface ShapeNodeData extends NodeData {
  shape?: string;
  sublabel?: string;
  accentColor?: string;
  serviceType?: string;
  cylinderAxis?: 'vertical' | 'horizontal';
}

export interface EdgeRenderData {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data: EdgeData | undefined;
  style?: Edge['style'];
  selected?: boolean;
  isFloating?: boolean;
  svgPath?: string;
  labelX?: number;
  labelY?: number;
}
