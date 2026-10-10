import { Node, Edge } from 'reactflow';

const node = (
  id: string,
  label: string,
  subtitle: string,
  layer: string,
  color: string,
  icon: string,
  x: number,
  y: number
): Node => ({
  id,
  type: 'systemNode',
  position: { x, y },
  data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 182, nodeHeight: 82 },
});

const edge = (
  id: string,
  source: string,
  target: string,
  label: string,
  connectionType: 'sync' | 'async' | 'event' | 'stream' | 'dep' = 'sync'
): Edge => ({
  id,
  source,
  target,
  type: 'simpleFloating',
  animated: connectionType !== 'sync',
  label,
  data: { label, edgeType: connectionType, connectionType, pathType: 'Smoothstep' },
  style: { strokeWidth: 1.5 },
});

export const cleanArchitectureNodes: Node[] = [
  node('ca_entity', 'Entities', 'Enterprise business', 'compute', '#0d9488', 'Box', 640, 100),
  node('ca_usecase', 'Use Cases', 'Application logic', 'compute', '#0d9488', 'Layers', 640, 260),
  node('ca_controller', 'Controllers', 'Interface adapter', 'compute', '#0d9488', 'Cpu', 320, 420),
  node('ca_presenter', 'Presenters', 'Output adapter', 'compute', '#0d9488', 'Monitor', 960, 420),
  node('ca_gateway', 'Gateways', 'DB / API wrapper', 'data', '#334155', 'Database', 960, 580),
  node('ca_frameworks', 'Frameworks', 'Web / DB / UI', 'data', '#334155', 'Layers', 320, 580),
  node('ca_external', 'External', 'DB, Web, Device', 'external', '#b45309', 'Globe', 640, 740),
];

export const cleanArchitectureEdges: Edge[] = [
  edge('ca_e1', 'ca_usecase', 'ca_entity', 'uses'),
  edge('ca_e2', 'ca_controller', 'ca_usecase', 'calls'),
  edge('ca_e3', 'ca_usecase', 'ca_presenter', 'presents via'),
  edge('ca_e4', 'ca_gateway', 'ca_usecase', 'implements port'),
  edge('ca_e5', 'ca_frameworks', 'ca_controller', 'drives'),
  edge('ca_e6', 'ca_frameworks', 'ca_gateway', 'uses'),
  edge('ca_e7', 'ca_gateway', 'ca_external', 'I/O', 'dep'),
  edge('ca_e8', 'ca_frameworks', 'ca_external', 'I/O', 'dep'),
];
