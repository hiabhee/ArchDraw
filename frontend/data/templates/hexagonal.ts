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

export const hexagonalNodes: Node[] = [
  node('hex_core', 'Domain Core', 'Business logic', 'compute', '#0d9488', 'Box', 640, 300),
  node('hex_port_in', 'Input Port', 'Driving port', 'compute', '#0d9488', 'Plug', 640, 140),
  node('hex_port_out', 'Output Port', 'Driven port', 'compute', '#0d9488', 'Plug', 640, 460),
  node('hex_adapter_rest', 'REST Adapter', 'HTTP', 'edge', '#0f766e', 'Webhook', 320, 140),
  node('hex_adapter_cli', 'CLI Adapter', 'Console', 'client', '#64748b', 'Terminal', 320, 300),
  node('hex_adapter_db', 'DB Adapter', 'Postgres', 'data', '#334155', 'Database', 960, 460),
  node('hex_adapter_queue', 'Queue Adapter', 'Kafka', 'async', '#b45309', 'MessagesSquare', 960, 300),
  node('hex_adapter_cache', 'Cache Adapter', 'Redis', 'data', '#334155', 'Layers', 960, 140),
];

export const hexagonalEdges: Edge[] = [
  edge('hex_e1', 'hex_adapter_rest', 'hex_port_in', 'via HTTP'),
  edge('hex_e2', 'hex_adapter_cli', 'hex_port_in', 'via CLI'),
  edge('hex_e3', 'hex_port_in', 'hex_core', 'uses port'),
  edge('hex_e4', 'hex_core', 'hex_port_out', 'emits'),
  edge('hex_e5', 'hex_port_out', 'hex_adapter_db', 'persists'),
  edge('hex_e6', 'hex_port_out', 'hex_adapter_queue', 'publishes', 'async'),
  edge('hex_e7', 'hex_port_out', 'hex_adapter_cache', 'caches', 'async'),
];
