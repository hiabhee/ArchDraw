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

export const requestResponseNodes: Node[] = [
  node('rr_client', 'Client', 'Browser / Mobile — initiates request', 'client', '#64748b', 'Monitor', 0, 300),
  node('rr_dns', 'DNS', 'Route 53 — resolves domain', 'client', '#64748b', 'Globe', 320, 80),
  node('rr_cdn', 'CDN', 'Cloudflare — edge cache', 'client', '#64748b', 'Cloud', 320, 180),
  node('rr_lb', 'Load Balancer', 'Nginx — distributes traffic', 'edge', '#0f766e', 'Scale', 320, 320),
  node('rr_gateway', 'API Gateway', 'Kong — routing & middleware', 'edge', '#0f766e', 'Webhook', 640, 300),
  node('rr_auth', 'Auth Service', 'JWT/OAuth — verifies identity', 'compute', '#0d9488', 'Shield', 640, 100),
  node('rr_service', 'Application Server', 'Business logic & controller', 'compute', '#0d9488', 'Cpu', 960, 300),
  node('rr_cache', 'Cache', 'Redis — fast lookup', 'data', '#334155', 'Zap', 960, 100),
  node('rr_db', 'Database', 'PostgreSQL — persistent store', 'data', '#334155', 'Database', 960, 500),
];

export const requestResponseEdges: Edge[] = [
  // Client → Edge (DNS + CDN + LB)
  edge('rr_e1', 'rr_client', 'rr_dns', '1. DNS query'),
  edge('rr_e2', 'rr_dns', 'rr_cdn', '2. Resolve / edge hit?'),
  edge('rr_e3', 'rr_cdn', 'rr_lb', '3. Miss → forward'),
  edge('rr_e4', 'rr_client', 'rr_lb', 'HTTP Request (GET /api)'),
  // Gateway ingress + middleware
  edge('rr_e5', 'rr_lb', 'rr_gateway', '4. Forward'),
  edge('rr_e6', 'rr_gateway', 'rr_auth', '5. Verify JWT'),
  edge('rr_e7', 'rr_auth', 'rr_gateway', '6. Auth OK + claims'),
  // Core request handling
  edge('rr_e8', 'rr_gateway', 'rr_service', '7. Route to service'),
  edge('rr_e9', 'rr_service', 'rr_cache', '8. GET cache'),
  edge('rr_e10', 'rr_cache', 'rr_service', '9a. Hit → return'),
  edge('rr_e11', 'rr_service', 'rr_db', '9b. Miss → SQL query'),
  edge('rr_e12', 'rr_db', 'rr_service', '10. Rows / result'),
  // Response path (completes the cycle)
  edge('rr_e13', 'rr_service', 'rr_gateway', '11. JSON response'),
  edge('rr_e14', 'rr_gateway', 'rr_lb', '12. 200 OK'),
  edge('rr_e15', 'rr_lb', 'rr_client', '13. HTTP Response'),
  // Non-blocking side effects (does not block response)
  edge('rr_e16', 'rr_gateway', 'rr_cdn', 'cache response', 'event'),
  edge('rr_e17', 'rr_service', 'rr_gateway', 'metrics / logs', 'event'),
];
