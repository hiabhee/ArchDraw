import { SystemNode } from '@/components/canvas/nodes/SystemNode';
import { ShapeNode } from '@/components/canvas/nodes/ShapeNode';
import { GroupNode } from '@/components/canvas/nodes/GroupNode';
import { TextLabelNode } from '@/components/canvas/nodes/TextLabelNode';
import { AnnotationNode } from '@/components/canvas/nodes/AnnotationNode';
import SimpleFloatingEdge from '@/components/canvas/edges/SimpleFloatingEdge';
import type { NodeTypes, EdgeTypes } from 'reactflow';

export const NODE_TYPES: NodeTypes = {
  systemNode:        SystemNode,
  architectureNode:  SystemNode,
  baseNode:          SystemNode,
  databaseNode:      SystemNode,
  cacheNode:         SystemNode,
  shapeNode:         ShapeNode,
  groupNode:         GroupNode,
  group:             GroupNode,
  frameNode:         GroupNode,
  serviceNode:       SystemNode,
  textLabelNode:     TextLabelNode,
  annotationNode:    AnnotationNode,
  messageBrokerNode: SystemNode,
  customNode:        SystemNode,
  custom:            SystemNode,
};

export const EDGE_TYPES: EdgeTypes = {
  custom:          SimpleFloatingEdge,
  simpleFloating:  SimpleFloatingEdge,
  floating:        SimpleFloatingEdge,
  default:         SimpleFloatingEdge,
  smoothstep:      SimpleFloatingEdge,
  flow:            SimpleFloatingEdge,
  async:           SimpleFloatingEdge,
  sync:            SimpleFloatingEdge,
  stream:          SimpleFloatingEdge,
  event:           SimpleFloatingEdge,
  dep:             SimpleFloatingEdge,
  dotted:          SimpleFloatingEdge,
};
