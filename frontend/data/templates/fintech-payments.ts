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
  data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 200, nodeHeight: 82 },
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

export const fintechPaymentsNodes: Node[] = [
  node('fp_mobile', 'Mobile App', 'Checkout + wallet', 'client', '#64748b', 'Smartphone', 0, 120),
  node('fp_web', 'Web App', 'Merchant checkout', 'client', '#64748b', 'Monitor', 0, 300),
  node('fp_gateway', 'API Gateway', 'Auth + throttling', 'edge', '#0f766e', 'Webhook', 320, 210),
  node('fp_risk', 'Risk Engine', 'Fraud scoring', 'compute', '#0d9488', 'ShieldCheck', 640, 60),
  node('fp_payment', 'Payment Service', 'Authorize + capture', 'compute', '#0d9488', 'CreditCard', 640, 210),
  node('fp_ledger', 'Ledger Service', 'Double-entry records', 'compute', '#0d9488', 'BookOpen', 640, 360),
  node('fp_queue', 'Payment Events', 'Kafka topics', 'async', '#d97706', 'Radio', 960, 210),
  node('fp_processor', 'Card Processor', 'External acquirer', 'external', '#0f766e', 'Landmark', 960, 40),
  node('fp_bank', 'Bank Network', 'Settlement rails', 'external', '#0f766e', 'Building2', 1280, 40),
  node('fp_db', 'Payments DB', 'Transactions', 'data', '#64748b', 'Database', 960, 360),
  node('fp_warehouse', 'Data Warehouse', 'Finance analytics', 'data', '#64748b', 'Warehouse', 1280, 300),
  node('fp_alerts', 'Alerting', 'Risk + ops alerts', 'observe', '#475569', 'BellRing', 1280, 500),
];

export const fintechPaymentsEdges: Edge[] = [
  edge('fp_e1', 'fp_mobile', 'fp_gateway', 'checkout'),
  edge('fp_e2', 'fp_web', 'fp_gateway', 'checkout'),
  edge('fp_e3', 'fp_gateway', 'fp_risk', 'score payment'),
  edge('fp_e4', 'fp_gateway', 'fp_payment', 'authorize'),
  edge('fp_e5', 'fp_payment', 'fp_processor', 'card auth', 'dep'),
  edge('fp_e6', 'fp_processor', 'fp_bank', 'settlement', 'dep'),
  edge('fp_e7', 'fp_payment', 'fp_ledger', 'record entry'),
  edge('fp_e8', 'fp_payment', 'fp_queue', 'payment event', 'event'),
  edge('fp_e9', 'fp_ledger', 'fp_db', 'write ledger'),
  edge('fp_e10', 'fp_payment', 'fp_db', 'write transaction'),
  edge('fp_e11', 'fp_queue', 'fp_warehouse', 'stream facts', 'stream'),
  edge('fp_e12', 'fp_risk', 'fp_alerts', 'suspicious activity', 'async'),
  edge('fp_e13', 'fp_queue', 'fp_alerts', 'failed payment', 'async'),
];
