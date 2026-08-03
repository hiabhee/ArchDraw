import { Node, Edge } from 'reactflow';

const node = (
  id: string,
  label: string,
  subtitle: string,
  category: string,
  color: string,
  icon: string,
  x: number,
  y: number
): Node => ({
  id,
  type: 'systemNode',
  position: { x, y },
  data: { label, subtitle, category, color, icon, nodeWidth: 184, nodeHeight: 82 },
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

export const videoStreamingNodes: Node[] = [
  node('vs_viewer', 'Viewer App', 'Web + mobile playback', 'Client & Entry', '#5A5A5A', 'MonitorPlay', 0, 120),
  node('vs_creator', 'Creator Studio', 'Upload + manage video', 'Client & Entry', '#5A5A5A', 'Clapperboard', 0, 340),
  node('vs_cdn', 'CDN Edge', 'Segment delivery', 'Client & Entry', '#5A5A5A', 'RadioTower', 320, 120),
  node('vs_gateway', 'API Gateway', 'Auth + routing', 'Client & Entry', '#5A5A5A', 'Webhook', 320, 340),
  node('vs_playback', 'Playback Service', 'Entitlements + manifest', 'Compute', '#64748b', 'Play', 640, 80),
  node('vs_catalog', 'Catalog Service', 'Titles + metadata', 'Compute', '#64748b', 'Library', 640, 240),
  node('vs_upload', 'Upload Service', 'Multipart ingestion', 'Compute', '#64748b', 'UploadCloud', 640, 420),
  node('vs_queue', 'Transcode Queue', 'Encoding jobs', 'Messaging & Events', '#b45309', 'MessagesSquare', 960, 420),
  node('vs_transcoder', 'Transcoder Fleet', 'HLS/DASH renditions', 'Compute', '#64748b', 'Cpu', 1280, 420),
  node('vs_manifest', 'Manifest Service', 'Adaptive bitrate', 'Compute', '#64748b', 'FileJson', 960, 80),
  node('vs_cache', 'Edge Cache', 'Hot manifests', 'Caching', '#b45309', 'Zap', 1280, 80),
  node('vs_object', 'Object Storage', 'Video segments', 'Data Storage', '#334155', 'HardDrive', 1600, 300),
  node('vs_db', 'Metadata DB', 'Titles + assets', 'Data Storage', '#334155', 'Database', 1280, 240),
  node('vs_search', 'Search Index', 'Discovery', 'Data Storage', '#334155', 'Search', 1600, 80),
  node('vs_events', 'Playback Events', 'QoE pipeline', 'Messaging & Events', '#b45309', 'Radio', 960, 600),
  node('vs_analytics', 'Analytics Warehouse', 'Watch history + QoE', 'Observability', '#64748b', 'BarChart3', 1280, 600),
  node('vs_monitoring', 'Monitoring', 'Errors + bitrate drops', 'Observability', '#64748b', 'Activity', 1600, 600),
];

export const videoStreamingEdges: Edge[] = [
  edge('vs_e1', 'vs_viewer', 'vs_cdn', 'stream segments', 'stream'),
  edge('vs_e2', 'vs_viewer', 'vs_gateway', 'play request'),
  edge('vs_e3', 'vs_gateway', 'vs_playback', 'authorize playback'),
  edge('vs_e4', 'vs_playback', 'vs_manifest', 'manifest request'),
  edge('vs_e5', 'vs_manifest', 'vs_cache', 'hot manifest'),
  edge('vs_e6', 'vs_cache', 'vs_cdn', 'edge fill', 'dep'),
  edge('vs_e7', 'vs_cdn', 'vs_object', 'origin fetch', 'dep'),
  edge('vs_e8', 'vs_playback', 'vs_catalog', 'title lookup'),
  edge('vs_e9', 'vs_catalog', 'vs_db', 'read metadata'),
  edge('vs_e10', 'vs_catalog', 'vs_search', 'index titles', 'async'),
  edge('vs_e11', 'vs_creator', 'vs_gateway', 'upload request'),
  edge('vs_e12', 'vs_gateway', 'vs_upload', 'init upload'),
  edge('vs_e13', 'vs_upload', 'vs_object', 'raw video'),
  edge('vs_e14', 'vs_upload', 'vs_queue', 'transcode job', 'event'),
  edge('vs_e15', 'vs_queue', 'vs_transcoder', 'process job', 'async'),
  edge('vs_e16', 'vs_transcoder', 'vs_object', 'renditions'),
  edge('vs_e17', 'vs_transcoder', 'vs_db', 'asset metadata'),
  edge('vs_e18', 'vs_viewer', 'vs_events', 'playback telemetry', 'event'),
  edge('vs_e19', 'vs_events', 'vs_analytics', 'stream facts', 'stream'),
  edge('vs_e20', 'vs_events', 'vs_monitoring', 'QoE alerts', 'async'),
  edge('vs_e21', 'vs_playback', 'vs_monitoring', 'latency metrics', 'event'),
];
