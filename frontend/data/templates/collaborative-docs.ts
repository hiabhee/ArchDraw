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
  data: { label, subtitle, layer, category: layer, color, icon, nodeWidth: 184, nodeHeight: 82 },
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

export const collaborativeDocsNodes: Node[] = [
  node('cd_browser', 'Browser Editor', 'Rich text canvas', 'client', '#64748b', 'FileText', 0, 120),
  node('cd_mobile', 'Mobile Editor', 'Offline edits', 'client', '#64748b', 'Smartphone', 0, 300),
  node('cd_edge', 'Edge Router', 'Sessions + region', 'edge', '#0f766e', 'Route', 320, 210),
  node('cd_presence', 'Presence Service', 'Cursors + viewers', 'compute', '#0d9488', 'MousePointer2', 640, 60),
  node('cd_collab', 'Collab Service', 'CRDT operations', 'compute', '#0d9488', 'UsersRound', 640, 210),
  node('cd_api', 'Document API', 'Metadata + sharing', 'compute', '#0d9488', 'FileStack', 640, 360),
  node('cd_pubsub', 'Realtime Pub/Sub', 'Fanout channels', 'async', '#d97706', 'RadioTower', 960, 210),
  node('cd_snapshot', 'Snapshot Worker', 'Compaction jobs', 'async', '#d97706', 'TimerReset', 960, 380),
  node('cd_redis', 'Redis', 'Presence cache', 'external', '#0f766e', 'Zap', 960, 40),
  node('cd_docdb', 'Document Store', 'CRDT log + docs', 'data', '#64748b', 'Database', 1280, 210),
  node('cd_search', 'Search Index', 'Full text search', 'data', '#64748b', 'Search', 1280, 380),
  node('cd_metrics', 'Metrics', 'Latency + conflicts', 'observe', '#475569', 'Activity', 1280, 560),
];

export const collaborativeDocsEdges: Edge[] = [
  edge('cd_e1', 'cd_browser', 'cd_edge', 'open doc'),
  edge('cd_e2', 'cd_mobile', 'cd_edge', 'sync edits'),
  edge('cd_e3', 'cd_edge', 'cd_presence', 'join room', 'stream'),
  edge('cd_e4', 'cd_edge', 'cd_collab', 'submit op', 'stream'),
  edge('cd_e5', 'cd_edge', 'cd_api', 'doc metadata'),
  edge('cd_e6', 'cd_presence', 'cd_redis', 'cursor state'),
  edge('cd_e7', 'cd_collab', 'cd_pubsub', 'broadcast op', 'event'),
  edge('cd_e8', 'cd_pubsub', 'cd_browser', 'remote ops', 'stream'),
  edge('cd_e9', 'cd_collab', 'cd_docdb', 'append op'),
  edge('cd_e10', 'cd_api', 'cd_docdb', 'read document'),
  edge('cd_e11', 'cd_pubsub', 'cd_snapshot', 'compact trigger', 'async'),
  edge('cd_e12', 'cd_snapshot', 'cd_docdb', 'write snapshot'),
  edge('cd_e13', 'cd_api', 'cd_search', 'index update', 'async'),
  edge('cd_e14', 'cd_collab', 'cd_metrics', 'conflict rate', 'event'),
];
