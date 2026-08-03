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

export const foodDeliveryNodes: Node[] = [
  node('fd_customer', 'Customer App', 'Browse + order', 'client', '#64748b', 'Smartphone', 0, 100),
  node('fd_courier', 'Courier App', 'Live assignment', 'client', '#64748b', 'Bike', 0, 300),
  node('fd_restaurant', 'Restaurant Portal', 'Accept orders', 'client', '#64748b', 'Store', 0, 500),
  node('fd_gateway', 'API Gateway', 'Auth + routing', 'edge', '#0f766e', 'Webhook', 320, 300),
  node('fd_catalog', 'Catalog Service', 'Menus + pricing', 'compute', '#0d9488', 'Utensils', 640, 80),
  node('fd_order', 'Order Service', 'Order lifecycle', 'compute', '#0d9488', 'ReceiptText', 640, 260),
  node('fd_dispatch', 'Dispatch Service', 'Courier matching', 'compute', '#0d9488', 'MapPinned', 640, 440),
  node('fd_location', 'Location Stream', 'Courier GPS', 'stream', '#d97706', 'Navigation', 960, 440),
  node('fd_events', 'Order Events', 'Kafka pipeline', 'async', '#d97706', 'MessagesSquare', 960, 260),
  node('fd_payment', 'Payment Service', 'Capture + refunds', 'compute', '#0d9488', 'CreditCard', 960, 80),
  node('fd_db', 'Orders DB', 'Transactional state', 'data', '#64748b', 'Database', 1280, 260),
  node('fd_search', 'Search Index', 'Restaurant discovery', 'data', '#64748b', 'Search', 1280, 80),
  node('fd_notify', 'Notification Service', 'Push + SMS', 'async', '#d97706', 'Bell', 1280, 440),
  node('fd_dashboard', 'Ops Dashboard', 'SLA monitoring', 'observe', '#475569', 'LayoutDashboard', 1280, 620),
];

export const foodDeliveryEdges: Edge[] = [
  edge('fd_e1', 'fd_customer', 'fd_gateway', 'browse'),
  edge('fd_e2', 'fd_restaurant', 'fd_gateway', 'menu updates'),
  edge('fd_e3', 'fd_courier', 'fd_gateway', 'availability'),
  edge('fd_e4', 'fd_gateway', 'fd_catalog', 'menus'),
  edge('fd_e5', 'fd_gateway', 'fd_order', 'place order'),
  edge('fd_e6', 'fd_order', 'fd_payment', 'charge'),
  edge('fd_e7', 'fd_order', 'fd_dispatch', 'request courier'),
  edge('fd_e8', 'fd_dispatch', 'fd_location', 'track couriers', 'stream'),
  edge('fd_e9', 'fd_order', 'fd_events', 'order changed', 'event'),
  edge('fd_e10', 'fd_events', 'fd_notify', 'status update', 'async'),
  edge('fd_e11', 'fd_order', 'fd_db', 'write order'),
  edge('fd_e12', 'fd_catalog', 'fd_search', 'index menu', 'async'),
  edge('fd_e13', 'fd_dispatch', 'fd_db', 'assignment'),
  edge('fd_e14', 'fd_events', 'fd_dashboard', 'ops metrics', 'stream'),
  edge('fd_e15', 'fd_notify', 'fd_customer', 'push update', 'async'),
];
