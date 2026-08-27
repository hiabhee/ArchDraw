import { Node, Edge } from 'reactflow';
const node = (id: string, label: string, subtitle: string, layer: string, color: string, icon: string, x: number, y: number): Node => ({ id, type: 'systemNode', position: { x, y }, data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 182, nodeHeight: 82 }});
const edge = (id: string, s: string, t: string, l: string, c: 'sync'|'async'|'event'|'stream'|'dep'='sync'): Edge => ({ id, source: s, target: t, type: 'simpleFloating', animated: c!=='sync', label: l, data: { label: l, edgeType: c, connectionType: c, pathType: 'Smoothstep' }, style: { strokeWidth: 1.5 }});
export const microservicesNodes: Node[] = [
  node('ms_client', 'Client', 'Web / Mobile', 'client', '#64748b', 'Monitor', 640, 0),
  node('ms_gateway', 'API Gateway', 'Auth + routing', 'edge', '#0f766e', 'Webhook', 640, 160),
  node('ms_auth', 'Auth Service', 'JWT', 'compute', '#0d9488', 'Shield', 320, 320),
  node('ms_user', 'User Service', 'Profiles', 'compute', '#0d9488', 'Users', 640, 320),
  node('ms_order', 'Order Service', 'Orders', 'compute', '#0d9488', 'Receipt', 960, 320),
  node('ms_user_db', 'User DB', 'Postgres', 'data', '#334155', 'Database', 320, 480),
  node('ms_order_db', 'Order DB', 'Postgres', 'data', '#334155', 'Database', 960, 480),
  node('ms_bus', 'Event Bus', 'Kafka', 'async', '#b45309', 'MessagesSquare', 640, 640),
];
export const microservicesEdges: Edge[] = [
  edge('ms_e1', 'ms_client', 'ms_gateway', 'HTTPS'),
  edge('ms_e2', 'ms_gateway', 'ms_auth', 'auth'),
  edge('ms_e3', 'ms_gateway', 'ms_user', 'REST'),
  edge('ms_e4', 'ms_gateway', 'ms_order', 'REST'),
  edge('ms_e5', 'ms_user', 'ms_user_db', 'query'),
  edge('ms_e6', 'ms_order', 'ms_order_db', 'query'),
  edge('ms_e7', 'ms_user', 'ms_bus', 'events', 'event'),
  edge('ms_e8', 'ms_order', 'ms_bus', 'events', 'event'),
];
