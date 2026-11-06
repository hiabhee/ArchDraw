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
  node('ca_gateway', 'Gateways', 'Repository adapters', 'compute', '#0d9488', 'Database', 960, 580),
  node('ca_frameworks', 'Web Framework', 'Frameworks & drivers', 'client', '#64748b', 'Globe', 320, 580),
  node('ca_external', 'Database', 'Frameworks & drivers', 'data', '#334155', 'Database', 960, 740),
];

export const cleanArchitectureEdges: Edge[] = [
  edge('ca_e1', 'ca_usecase', 'ca_entity', 'uses'),
  edge('ca_e2', 'ca_controller', 'ca_usecase', 'input port'),
  edge('ca_e3', 'ca_presenter', 'ca_usecase', 'implements output port'),
  edge('ca_e4', 'ca_gateway', 'ca_usecase', 'implements repository port'),
  edge('ca_e5', 'ca_frameworks', 'ca_controller', 'HTTP request'),
  edge('ca_e6', 'ca_presenter', 'ca_frameworks', 'view model'),
  edge('ca_e7', 'ca_gateway', 'ca_external', 'SQL', 'dep'),
];
