import type { Node, Edge } from 'reactflow';

export interface DemoNodeData {
  isDemoDark?: boolean;
  label?: string;
  onRename?: (id: string, newName: string) => void;
  hasHeader?: boolean;
  height?: number;
  style?: Record<string, string>;
  headerColor?: string;
  subtitle?: string;
  comment?: string;
  layer?: string;
  accentColor?: string;
  color?: string;
  status?: string;
  nodeWidth?: number;
  nodeHeight?: number;
}

export interface DemoGroupData extends DemoNodeData {
  groupLabel?: string;
  groupColor?: string;
}

// Preset Diagram Definitions
export interface PresetData {
  title: string;
  nodes: Node[];
  edges: Edge[];
}
