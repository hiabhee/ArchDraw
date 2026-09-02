import { Node, Edge } from 'reactflow';
const node = (id: string, label: string, subtitle: string, layer: string, color: string, icon: string, x: number, y: number): Node => ({ id, type: 'systemNode', position: { x, y }, data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 200, nodeHeight: 100 }});
const edge = (id: string, source: string, target: string, label: string, t: 'sync'|'async'|'event'|'stream'|'dep'='sync'): Edge => ({ id, source, target, type: 'simpleFloating', animated: t!=='sync', label, data: { label, edgeType: t, connectionType: t, pathType: 'Smoothstep' }, style: { strokeWidth: 1.5 }});
export const layeredNodes: Node[] = [
  node('lay_client', 'Client', 'Browser / App', 'client', '#64748b', 'Monitor', 0, 220),
  node('lay_present', 'Presentation', 'Controllers, Views', 'edge', '#0f766e', 'Layout', 400, 220),
  node('lay_business', 'Business Logic', 'Services, Domain Model', 'compute', '#0d9488', 'Layers', 800, 220),
  node('lay_persist', 'Persistence', 'Repositories, DAOs', 'data', '#334155', 'Database', 1200, 220),
  node('lay_db', 'Database', 'RDBMS / NoSQL', 'data', '#334155', 'HardDrive', 1600, 220),
  node('lay_external', 'External Services', 'Payment, Email, SMS', 'external', '#b45309', 'Globe', 800, 420),
];
export const layeredEdges: Edge[] = [
  edge('lay_e1', 'lay_client', 'lay_present', 'HTTP / REST'),
  edge('lay_e2', 'lay_present', 'lay_business', 'calls'),
  edge('lay_e3', 'lay_business', 'lay_persist', 'uses'),
  edge('lay_e4', 'lay_persist', 'lay_db', 'SQL / Query'),
  edge('lay_e5', 'lay_business', 'lay_external', 'integrates', 'dep'),
  edge('lay_e6', 'lay_persist', 'lay_external', 'events', 'event'),
];
