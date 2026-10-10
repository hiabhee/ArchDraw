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

export const repoToDiagramNodes: Node[] = [
  // Client & entry
  node('rd_user', 'Developer', 'Pastes a GitHub URL', 'client', '#64748b', 'Monitor', 0, 240),
  node('rd_canvas', 'React Flow Canvas', 'Dagre layout via Mermaid relayout', 'client', '#64748b', 'Route', 1920, 300),

  // API + cache
  node('rd_api', 'Repo Diagram API', 'Quota check + SSE progress', 'edge', '#0f766e', 'Webhook', 320, 240),
  node('rd_cache', 'Result Cache', 'Memory + Redis · keyed by repo + SHA', 'data', '#64748b', 'Database', 320, 470),

  // Ingestion
  node('rd_ingest', 'Ingestion', 'Tarball zipball → Contents-API fallback', 'compute', '#0d9488', 'FileStack', 640, 240),
  node('rd_github', 'GitHub', 'Archive · git tree · file contents', 'external', '#0f766e', 'Network', 640, 30),

  // Deterministic analysis (no LLM)
  node('rd_analysis', 'Static Analysis', 'Subsystems · signals · import graph', 'compute', '#0d9488', 'Search', 960, 240),
  node('rd_baseline', 'Baseline Graph', 'Deterministic draft nodes/edges', 'compute', '#0d9488', 'Boxes', 960, 450),

  // LLM agents
  node('rd_classifier', 'Classifier Agent', 'LLM repo profile + extraction strategy', 'external', '#0f766e', 'Brain', 1280, 40),
  node('rd_extractor', 'Component Extractor', 'LLM components merged into baseline', 'external', '#0f766e', 'Cpu', 1280, 250),
  node('rd_relanalyst', 'Relationship Analyst', 'LLM edges + user journeys', 'external', '#0f766e', 'GitMerge', 1280, 460),

  // Verification & finalization (no LLM)
  node('rd_verify', 'Verifier', 'Evidence checks · drops hallucinations', 'compute', '#0d9488', 'Shield', 1600, 250),
  node('rd_finalize', 'Finalization', 'Node/edge caps · confidence · review notes', 'compute', '#0d9488', 'Layers', 1600, 460),
];

export const repoToDiagramEdges: Edge[] = [
  edge('rd_e1', 'rd_user', 'rd_api', 'paste repo URL'),
  edge('rd_e2', 'rd_api', 'rd_cache', 'check cache'),
  edge('rd_e3', 'rd_api', 'rd_ingest', 'cache miss → ingest'),
  edge('rd_e4', 'rd_ingest', 'rd_github', 'zipball · tree · contents', 'dep'),
  edge('rd_e5', 'rd_ingest', 'rd_analysis', 'file snapshot'),
  edge('rd_e6', 'rd_analysis', 'rd_baseline', 'signals + import graph'),
  edge('rd_e7', 'rd_analysis', 'rd_classifier', 'detection report'),
  edge('rd_e8', 'rd_classifier', 'rd_extractor', 'extraction strategy'),
  edge('rd_e9', 'rd_extractor', 'rd_relanalyst', 'component list'),
  edge('rd_e10', 'rd_relanalyst', 'rd_verify', 'edges + workflows'),
  edge('rd_e11', 'rd_analysis', 'rd_verify', 'import-graph evidence'),
  edge('rd_e12', 'rd_verify', 'rd_finalize', 'verified graph'),
  edge('rd_e13', 'rd_finalize', 'rd_canvas', 'nodes + edges'),
  edge('rd_e14', 'rd_finalize', 'rd_cache', 'persist non-degraded result', 'async'),
  edge('rd_e15', 'rd_api', 'rd_user', 'SSE stage progress', 'event'),
];
