import { Node, Edge } from 'reactflow';
const node = (id: string, label: string, subtitle: string, layer: string, color: string, icon: string, x: number, y: number): Node => ({ id, type: 'systemNode', position: { x, y }, data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 182, nodeHeight: 82 }});
const edge = (id: string, source: string, target: string, label: string, t: 'sync'|'async'|'event'|'stream'|'dep'='sync'): Edge => ({ id, source, target, type: 'simpleFloating', animated: t!=='sync', label, data: { label, edgeType: t, connectionType: t, pathType: 'Smoothstep' }, style: { strokeWidth: 1.5 }});
export const layeredNodes: Node[] = [
  node('lay_client', 'Client', 'Browser / App', 'client', '#64748b', 'Monitor', 0, 200),
  node('lay_present', 'Presentation', 'Controllers, Views', 'edge', '#0f766e', 'Layout', 320, 200),
  node('lay_business', 'Business', 'Services, Domain', 'compute', '#0d9488', 'Layers', 640, 200),
  node('lay_persist', 'Persistence', 'Repositories', 'data', '#334155', 'Database', 960, 200),
  node('lay_db', 'Database', 'RDBMS / NoSQL', 'data', '#334155', 'HardDrive', 1280, 200),
  node('lay_external', 'External', 'Payment, Email', 'external', '#b45309', 'Globe', 640, 400),
];
export const layeredEdges: Edge[] = [
  edge('lay_e1', 'lay_client', 'lay_present', 'HTTP'),
  edge('lay_e2', 'lay_present', 'lay_business', 'calls'),
  edge('lay_e3', 'lay_business', 'lay_persist', 'uses'),
  edge('lay_e4', 'lay_persist', 'lay_db', 'SQL'),
  edge('lay_e5', 'lay_business', 'lay_external', 'calls', 'dep'),
];
