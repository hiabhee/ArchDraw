import { Node, Edge } from 'reactflow';

export const rideshareNodes: Node[] = [
  // Client Layer (Col 0)
  { id: 'rs_rider', type: 'systemNode', position: { x: 0, y: 200 }, data: { label: 'Mobile App (Rider)', category: 'Client Layer', color: '#5A5A5A', icon: 'Smartphone' } },
  { id: 'rs_driver', type: 'systemNode', position: { x: 0, y: 400 }, data: { label: 'Mobile App (Driver)', category: 'Client Layer', color: '#5A5A5A', icon: 'Car' } },
  
  // Gateway Layer (Col 1)
  { id: 'rs_apigw', type: 'systemNode', position: { x: 350, y: 200 }, data: { label: 'API Gateway', category: 'Gateway Layer', color: '#64748b', icon: 'Webhook' } },
  { id: 'rs_ws', type: 'systemNode', position: { x: 350, y: 400 }, data: { label: 'WebSocket Server', category: 'Gateway Layer', color: '#64748b', icon: 'Radio' } },
  
  // Core Ride System (Col 2)
  { id: 'rs_usersvc', type: 'systemNode', position: { x: 700, y: 100 }, data: { label: 'User Service', category: 'Core Ride System', color: '#64748b', icon: 'Users' } },
  { id: 'rs_match', type: 'systemNode', position: { x: 700, y: 280 }, data: { label: 'Matching Service', category: 'Core Ride System', color: '#64748b', icon: 'GitMerge' } },
  { id: 'rs_driver_svc', type: 'systemNode', position: { x: 700, y: 460 }, data: { label: 'Driver Service', category: 'Core Ride System', color: '#64748b', icon: 'Truck' } },
  { id: 'rs_ride', type: 'systemNode', position: { x: 700, y: 640 }, data: { label: 'Ride Service', category: 'Core Ride System', color: '#64748b', icon: 'MapPin' } },
  
  // Real-Time Location System (Col 3)
  { id: 'rs_locsvc', type: 'systemNode', position: { x: 1050, y: 280 }, data: { label: 'Location Service', category: 'Real-Time Location System', color: '#b45309', icon: 'Map' } },
  
  // Async Processing System (Col 4)
  { id: 'rs_mq', type: 'systemNode', position: { x: 1400, y: 280 }, data: { label: 'Message Queue', category: 'Async Processing System', color: '#6b7280', icon: 'MessageSquare' } },
  { id: 'rs_worker', type: 'systemNode', position: { x: 1400, y: 460 }, data: { label: 'Background Worker', category: 'Async Processing System', color: '#6b7280', icon: 'Timer' } },
  { id: 'rs_notif', type: 'systemNode', position: { x: 1750, y: 380 }, data: { label: 'Notification Service', category: 'Async Processing System', color: '#6b7280', icon: 'Bell' } },
  { id: 'rs_billing', type: 'systemNode', position: { x: 1750, y: 540 }, data: { label: 'Billing Service', category: 'Async Processing System', color: '#6b7280', icon: 'CreditCard' } },
  
  // Data Layer (Col 5)
  { id: 'rs_db', type: 'systemNode', position: { x: 2100, y: 280 }, data: { label: 'Database', category: 'Data Layer', color: '#334155', icon: 'Database' } },
  { id: 'rs_cache', type: 'systemNode', position: { x: 2100, y: 460 }, data: { label: 'Cache', category: 'Data Layer', color: '#334155', icon: 'Layers' } },
];

const E = (id: string, source: string, target: string, label: string, animated: boolean = true): Edge => ({
  id, source, target, type: 'default', animated,
  style: { stroke: '#94a3b8', strokeWidth: '1.5px' },
  label,
  labelStyle: { fontSize: '11px', fill: '#64748b' },
  labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
});

export const rideshareEdges: Edge[] = [
  // Primary Flow - Rider Request
  E('rs_e1', 'rs_rider', 'rs_apigw', 'Ride Request'),
  E('rs_e2', 'rs_apigw', 'rs_usersvc', 'Authenticate'),
  E('rs_e3', 'rs_usersvc', 'rs_db', 'Validate User'),
  E('rs_e4', 'rs_apigw', 'rs_match', 'Find Driver'),
  E('rs_e5', 'rs_match', 'rs_cache', 'Check Cache'),
  E('rs_e6', 'rs_cache', 'rs_db', 'Cache Miss'),
  E('rs_e7', 'rs_match', 'rs_driver_svc', 'Get Drivers'),
  E('rs_e8', 'rs_driver_svc', 'rs_db', 'Query Drivers'),
  E('rs_e9', 'rs_match', 'rs_ride', 'Create Ride'),
  E('rs_e10', 'rs_ride', 'rs_db', 'Save Ride'),
  
  // Primary Flow - Connect Driver App to API Gateway
  E('rs_e11', 'rs_driver', 'rs_apigw', 'Trip Updates'),
  
  // Real-Time Flow - Driver Location Updates
  E('rs_e12', 'rs_driver', 'rs_ws', 'Location Update'),
  E('rs_e13', 'rs_ws', 'rs_locsvc', 'Process Location'),
  E('rs_e14', 'rs_locsvc', 'rs_match', 'Update Position'),
  E('rs_e15', 'rs_match', 'rs_cache', 'Update Cache'),
  
  // Async Flow - Post-Ride Processing
  E('rs_e16', 'rs_ride', 'rs_mq', 'Ride Completed'),
  E('rs_e17', 'rs_mq', 'rs_worker', 'Process Event'),
  E('rs_e18', 'rs_worker', 'rs_notif', 'Send Notification'),
  E('rs_e19', 'rs_worker', 'rs_billing', 'Process Payment'),
  
  // User Service Connections
  E('rs_e20', 'rs_apigw', 'rs_usersvc', 'Auth Check'),
  E('rs_e21', 'rs_driver_svc', 'rs_usersvc', 'Validate Driver'),
  E('rs_e22', 'rs_ride', 'rs_usersvc', 'Get User Data'),
];
