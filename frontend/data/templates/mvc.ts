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

export const mvcNodes: Node[] = [
  node('mvc_browser', 'Browser', 'User interface', 'client', '#64748b', 'Monitor', 0, 200),
  node('mvc_router', 'Router', 'URL dispatcher', 'edge', '#0f766e', 'Route', 320, 200),
  node('mvc_controller', 'Controller', 'Handles request', 'compute', '#0d9488', 'Cpu', 640, 200),
  node('mvc_model', 'Model', 'Business data', 'compute', '#0d9488', 'Box', 960, 120),
  node('mvc_view', 'View', 'Template', 'client', '#64748b', 'Layout', 960, 280),
  node('mvc_db', 'Database', 'Persistence', 'data', '#334155', 'Database', 1280, 200),
];

export const mvcEdges: Edge[] = [
  edge('mvc_e1', 'mvc_browser', 'mvc_router', 'HTTP request'),
  edge('mvc_e2', 'mvc_router', 'mvc_controller', 'route'),
  edge('mvc_e3', 'mvc_controller', 'mvc_model', 'updates'),
  edge('mvc_e4', 'mvc_model', 'mvc_db', 'query'),
  edge('mvc_e5', 'mvc_controller', 'mvc_view', 'selects'),
  edge('mvc_e6', 'mvc_view', 'mvc_browser', 'renders'),
  edge('mvc_e7', 'mvc_model', 'mvc_view', 'notifies'),
];
