import { Node, Edge } from 'reactflow';

/**
 * ArchDraw self-architecture template — reflects the post-refactor pipeline layout:
 *   pipeline-core          → execution engine (Pipeline, Stage, Context, DomainResult)
 *   pipeline-shared        → canonical layout (applyRfLayout) + RF adapters + progress
 *   ai/mermaid-pipeline    → Concept → Plan → LayoutOverride → Materialize → Score → Validate
 *   mermaid/pipeline       → Parse → Validate → Build → Layout → Size → ValidateOutput
 *   repo-diagram           → Ingest → Cache → Analysis → Baseline → Classify → Extract →
 *                            Relationships → Verify → Finalize → CacheWrite
 */

export const archdrawNodes: Node[] = [
  // ═══════════════════════════════════════════════════════════
  // GROUP: Client Tier (Browser)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_client',
    type: 'groupNode',
    position: { x: 0, y: 0 },
    data: { label: 'Client Tier (Browser)', groupLabel: 'Client Tier (Browser)', isGroup: true, color: '#64748b' },
    style: { width: 1100, height: 420 },
    zIndex: -1,
    width: 1100,
    height: 420,
  },
  {
    id: 'nd_webui',
    type: 'shapeNode',
    position: { x: 60, y: 70 },
    data: {
      label: 'Web UI Layer', subtitle: 'Next.js App Router',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Monitor',
    },
    width: 200, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_canvas',
    type: 'shapeNode',
    position: { x: 380, y: 70 },
    data: {
      label: 'React Flow Canvas', subtitle: 'Interactive Diagram Renderer',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Workflow',
    },
    width: 200, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_editor',
    type: 'shapeNode',
    position: { x: 700, y: 70 },
    data: {
      label: 'Mermaid Code Panel', subtitle: 'Live Edit → runMermaidPipeline',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Code',
    },
    width: 240, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_store',
    type: 'shapeNode',
    position: { x: 380, y: 250 },
    data: {
      label: 'Zustand Store', subtitle: 'Client State + Persistence',
      shape: 'cylinder', nodeWidth: 200, nodeHeight: 100,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Data Storage', icon: 'Database',
    },
    width: 200, height: 100, parentNode: 'grp_client', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Pipeline Core — shared execution engine
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_core',
    type: 'groupNode',
    position: { x: 0, y: 500 },
    data: { label: 'pipeline-core', groupLabel: 'pipeline-core', isGroup: true, color: '#64748b' },
    style: { width: 1100, height: 280 },
    zIndex: -1,
    width: 1100,
    height: 280,
  },
  {
    id: 'nd_pipeline',
    type: 'shapeNode',
    position: { x: 40, y: 70 },
    data: {
      label: 'Pipeline Engine', subtitle: 'Flat stage runner + weights + abort',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Compute', icon: 'Cpu',
    },
    width: 240, height: 90, parentNode: 'grp_core', extent: 'parent',
  },
  {
    id: 'nd_context',
    type: 'shapeNode',
    position: { x: 320, y: 70 },
    data: {
      label: 'PipelineContext', subtitle: 'signal · progress · sharedData',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Compute', icon: 'Boxes',
    },
    width: 240, height: 90, parentNode: 'grp_core', extent: 'parent',
  },
  {
    id: 'nd_domain',
    type: 'shapeNode',
    position: { x: 600, y: 70 },
    data: {
      label: 'DomainResult', subtitle: 'success | failure + error codes',
      shape: 'diamond', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'compute', typeId: 'microservice', color: '#64748b',
      category: 'Compute', icon: 'CheckCircle',
    },
    width: 200, height: 90, parentNode: 'grp_core', extent: 'parent',
  },
  {
    id: 'nd_metrics',
    type: 'shapeNode',
    position: { x: 860, y: 70 },
    data: {
      label: 'Stage Metrics', subtitle: 'duration · weights · terminal exit',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Observability', icon: 'BarChart2',
    },
    width: 200, height: 90, parentNode: 'grp_core', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: AI Mermaid Pipeline — prompt → diagram
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_ai',
    type: 'groupNode',
    position: { x: 0, y: 860 },
    data: { label: 'AI Mermaid Pipeline', groupLabel: 'AI Mermaid Pipeline', isGroup: true, color: '#0f766e' },
    style: { width: 1480, height: 420 },
    zIndex: -1,
    width: 1480,
    height: 420,
  },
  {
    id: 'nd_orchestrator',
    type: 'shapeNode',
    position: { x: 40, y: 60 },
    data: {
      label: 'Orchestrator', subtitle: 'generateDiagram → DomainResult',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'GitBranch',
    },
    width: 240, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_concepts',
    type: 'shapeNode',
    position: { x: 320, y: 60 },
    data: {
      label: 'Concept Detection', subtitle: 'Template fast path',
      shape: 'diamond', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'compute', typeId: 'microservice', color: '#0f766e',
      category: 'Compute', icon: 'Search',
    },
    width: 200, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_planner',
    type: 'shapeNode',
    position: { x: 560, y: 60 },
    data: {
      label: 'Architecture Planning', subtitle: 'architecturePlanner (LLM)',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 240, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_layoutoverride',
    type: 'shapeNode',
    position: { x: 840, y: 60 },
    data: {
      label: 'Layout Override', subtitle: 'Direction / style overrides',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'Layout',
    },
    width: 200, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_materialize',
    type: 'shapeNode',
    position: { x: 1100, y: 60 },
    data: {
      label: 'Mermaid Materialize', subtitle: 'Parse · retry · fallback',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'FileCode',
    },
    width: 240, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_score',
    type: 'shapeNode',
    position: { x: 320, y: 240 },
    data: {
      label: 'Score Stage', subtitle: 'scoreDiagram (0–100)',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'Gauge',
    },
    width: 200, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_aivalidate',
    type: 'shapeNode',
    position: { x: 560, y: 240 },
    data: {
      label: 'Validation Stage', subtitle: 'Semantic + mechanical checks',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'ShieldCheck',
    },
    width: 240, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_keymgr',
    type: 'shapeNode',
    position: { x: 840, y: 240 },
    data: {
      label: 'API Key Manager', subtitle: 'Multi-key rotation + retry',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Auth & Security', icon: 'Key',
    },
    width: 240, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_diagcache',
    type: 'shapeNode',
    position: { x: 1120, y: 240 },
    data: {
      label: 'Diagram Cache', subtitle: 'LRU in-memory (prompt hits)',
      shape: 'cylinder', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Caching', icon: 'Layers',
    },
    width: 200, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Mermaid Processing — deterministic RF conversion
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_mermaid',
    type: 'groupNode',
    position: { x: 1580, y: 0 },
    data: { label: 'Mermaid Pipeline', groupLabel: 'Mermaid Pipeline', isGroup: true, color: '#0f766e' },
    style: { width: 360, height: 980 },
    zIndex: -1,
    width: 360,
    height: 980,
  },
  {
    id: 'nd_parse',
    type: 'shapeNode',
    position: { x: 50, y: 60 },
    data: {
      label: 'ParseStage', subtitle: 'Mermaid text → AST',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'FileCode',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_validate',
    type: 'shapeNode',
    position: { x: 50, y: 190 },
    data: {
      label: 'ValidateStage', subtitle: 'AST schema check',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'ShieldCheck',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_build',
    type: 'shapeNode',
    position: { x: 50, y: 320 },
    data: {
      label: 'BuildStage', subtitle: 'AST → ReactFlow objects',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'Workflow',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_layoutstage',
    type: 'shapeNode',
    position: { x: 50, y: 450 },
    data: {
      label: 'LayoutStage', subtitle: 'applyRfLayout (shared)',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'Layout',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_size',
    type: 'shapeNode',
    position: { x: 50, y: 580 },
    data: {
      label: 'SizeStage', subtitle: 'Subgraph container bounds',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'Maximize2',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_finalval',
    type: 'shapeNode',
    position: { x: 50, y: 710 },
    data: {
      label: 'FinalValidation', subtitle: 'Output integrity warnings',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'CheckCircle',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_relayout',
    type: 'shapeNode',
    position: { x: 50, y: 840 },
    data: {
      label: 'Relayout Helper', subtitle: 'Canvas LR/TD toggles',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#0f766e',
      category: 'Compute', icon: 'RefreshCw',
    },
    width: 260, height: 80, parentNode: 'grp_mermaid', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: pipeline-shared — canonical layout + adapters
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_shared',
    type: 'groupNode',
    position: { x: 2040, y: 0 },
    data: { label: 'pipeline-shared', groupLabel: 'pipeline-shared', isGroup: true, color: '#475569' },
    style: { width: 360, height: 520 },
    zIndex: -1,
    width: 360,
    height: 520,
  },
  {
    id: 'nd_applyrf',
    type: 'shapeNode',
    position: { x: 50, y: 60 },
    data: {
      label: 'applyRfLayout', subtitle: 'Canonical layout entry point',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#475569',
      category: 'Compute', icon: 'Layout',
    },
    width: 260, height: 90, parentNode: 'grp_shared', extent: 'parent',
  },
  {
    id: 'nd_dagre',
    type: 'shapeNode',
    position: { x: 50, y: 200 },
    data: {
      label: 'DagreLayoutEngine', subtitle: 'Compound graph + cycle guard',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#475569',
      category: 'Compute', icon: 'GitMerge',
    },
    width: 260, height: 90, parentNode: 'grp_shared', extent: 'parent',
  },
  {
    id: 'nd_elk',
    type: 'shapeNode',
    position: { x: 50, y: 340 },
    data: {
      label: 'Elk / Integrated', subtitle: 'Optional ELK + canvas presets',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#475569',
      category: 'Compute', icon: 'LayoutTemplate',
    },
    width: 260, height: 90, parentNode: 'grp_shared', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Repo Diagram Pipeline — GitHub → architecture
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_repo',
    type: 'groupNode',
    position: { x: 2040, y: 600 },
    data: { label: 'Repo Diagram Pipeline', groupLabel: 'Repo Diagram Pipeline', isGroup: true, color: '#b45309' },
    style: { width: 720, height: 680 },
    zIndex: -1,
    width: 720,
    height: 680,
  },
  {
    id: 'nd_ingest',
    type: 'shapeNode',
    position: { x: 40, y: 50 },
    data: {
      label: 'Ingest', subtitle: 'GitHub tarball → snapshot',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'Download',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_cachecheck',
    type: 'shapeNode',
    position: { x: 280, y: 50 },
    data: {
      label: 'Cache Check', subtitle: 'Terminal early-exit on hit',
      shape: 'diamond', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'compute', typeId: 'microservice', color: '#b45309',
      category: 'Caching', icon: 'Zap',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_analysis',
    type: 'shapeNode',
    position: { x: 520, y: 50 },
    data: {
      label: 'Analysis', subtitle: 'Static signals + import graph',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'Search',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_baseline',
    type: 'shapeNode',
    position: { x: 40, y: 180 },
    data: {
      label: 'Baseline', subtitle: 'Heuristic graph seed',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'Layers',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_classify',
    type: 'shapeNode',
    position: { x: 280, y: 180 },
    data: {
      label: 'Classify', subtitle: 'Repo profile + pass-2 files',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'AI / ML', icon: 'Tag',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_extract',
    type: 'shapeNode',
    position: { x: 520, y: 180 },
    data: {
      label: 'Extract', subtitle: 'LLM / heuristic components',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'AI / ML', icon: 'Boxes',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_relationships',
    type: 'shapeNode',
    position: { x: 40, y: 310 },
    data: {
      label: 'Relationships', subtitle: 'Edges + workflows',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'AI / ML', icon: 'GitBranch',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_verify',
    type: 'shapeNode',
    position: { x: 280, y: 310 },
    data: {
      label: 'Verify', subtitle: 'Verifier + prune',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'ShieldCheck',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_finalize',
    type: 'shapeNode',
    position: { x: 520, y: 310 },
    data: {
      label: 'Finalization', subtitle: 'Sanitize + compile RF',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'Package',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_cachewrite',
    type: 'shapeNode',
    position: { x: 280, y: 440 },
    data: {
      label: 'Cache Write', subtitle: 'Optional Redis persist',
      shape: 'cylinder', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Caching', icon: 'HardDrive',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_github',
    type: 'shapeNode',
    position: { x: 40, y: 560 },
    data: {
      label: 'GitHub API', subtitle: 'Tarball + contents',
      shape: 'hexagon', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'external', typeId: 'third_party_api', color: '#6b7280',
      category: 'Client & Entry', icon: 'Github',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },
  {
    id: 'nd_repolayout',
    type: 'shapeNode',
    position: { x: 280, y: 560 },
    data: {
      label: 'Compile → Layout', subtitle: 'Shared applyRfLayout',
      shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#b45309',
      category: 'Compute', icon: 'Layout',
    },
    width: 200, height: 80, parentNode: 'grp_repo', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Canvas Rendering
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_render',
    type: 'groupNode',
    position: { x: 2860, y: 0 },
    data: { label: 'Canvas Rendering', groupLabel: 'Canvas Rendering', isGroup: true, color: '#64748b' },
    style: { width: 360, height: 420 },
    zIndex: -1,
    width: 360,
    height: 420,
  },
  {
    id: 'nd_sysnode',
    type: 'shapeNode',
    position: { x: 50, y: 60 },
    data: {
      label: 'SystemNode', subtitle: 'Service / compute components',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Box',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },
  {
    id: 'nd_shapenode',
    type: 'shapeNode',
    position: { x: 50, y: 180 },
    data: {
      label: 'ShapeNode', subtitle: 'Cylinder, diamond, hexagon',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Shapes',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },
  {
    id: 'nd_floatedge',
    type: 'shapeNode',
    position: { x: 50, y: 300 },
    data: {
      label: 'SimpleFloatingEdge', subtitle: 'Dynamic handles + routes',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#64748b',
      category: 'Client & Entry', icon: 'Spline',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Supabase Backend
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_backend',
    type: 'groupNode',
    position: { x: 2860, y: 500 },
    data: { label: 'Supabase Backend', groupLabel: 'Supabase Backend', isGroup: true, color: '#475569' },
    style: { width: 360, height: 420 },
    zIndex: -1,
    width: 360,
    height: 420,
  },
  {
    id: 'nd_auth',
    type: 'shapeNode',
    position: { x: 50, y: 60 },
    data: {
      label: 'Authentication', subtitle: 'OAuth + RLS',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'auth', typeId: 'auth_service', color: '#475569',
      category: 'Auth & Security', icon: 'Shield',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },
  {
    id: 'nd_db',
    type: 'shapeNode',
    position: { x: 50, y: 180 },
    data: {
      label: 'PostgreSQL', subtitle: 'Diagrams · profiles · versions',
      shape: 'cylinder', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Data Storage', icon: 'Database',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },
  {
    id: 'nd_realtime',
    type: 'shapeNode',
    position: { x: 50, y: 300 },
    data: {
      label: 'Realtime Sync', subtitle: 'Collaboration + presence',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#475569',
      category: 'Messaging & Events', icon: 'Radio',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: External AI Providers
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_providers',
    type: 'groupNode',
    position: { x: 0, y: 1360 },
    data: { label: 'External AI Providers', groupLabel: 'External AI Providers', isGroup: true, color: '#6b7280' },
    style: { width: 800, height: 200 },
    zIndex: -1,
    width: 800,
    height: 200,
  },
  {
    id: 'nd_groq',
    type: 'shapeNode',
    position: { x: 60, y: 55 },
    data: {
      label: 'Groq', subtitle: 'Primary — gpt-oss / Llama 3.3',
      shape: 'hexagon', nodeWidth: 300, nodeHeight: 90,
      serviceType: 'external', typeId: 'llm_api', color: '#6b7280',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 300, height: 90, parentNode: 'grp_providers', extent: 'parent',
  },
  {
    id: 'nd_openrouter',
    type: 'shapeNode',
    position: { x: 420, y: 55 },
    data: {
      label: 'OpenRouter', subtitle: 'Fallback — Claude / GPT',
      shape: 'hexagon', nodeWidth: 300, nodeHeight: 90,
      serviceType: 'external', typeId: 'llm_api', color: '#6b7280',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 300, height: 90, parentNode: 'grp_providers', extent: 'parent',
  },
];

export const archdrawEdges: Edge[] = [
  // Client internal
  {
    id: 'e_webui_canvas', source: 'nd_webui', target: 'nd_canvas',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'renders diagram',
    data: { label: 'renders diagram', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_canvas_store', source: 'nd_canvas', target: 'nd_store',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'reads/writes state',
    data: { label: 'reads/writes state', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_editor_canvas', source: 'nd_editor', target: 'nd_canvas',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'live preview sync',
    data: { label: 'live preview sync', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_editor_store', source: 'nd_editor', target: 'nd_store',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'mermaid code sync',
    data: { label: 'mermaid code sync', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // Client → AI / Mermaid / Repo entry points
  {
    id: 'e_webui_orchestrator', source: 'nd_webui', target: 'nd_orchestrator',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'prompt generate',
    data: { label: 'prompt generate', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_editor_parse', source: 'nd_editor', target: 'nd_parse',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'runMermaidPipeline',
    data: { label: 'runMermaidPipeline', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_webui_ingest', source: 'nd_webui', target: 'nd_ingest',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'repo URL',
    data: { label: 'repo URL', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // Client → pipeline-core (all domain pipelines execute here)
  {
    id: 'e_orchestrator_pipeline', source: 'nd_orchestrator', target: 'nd_pipeline',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'Pipeline.execute',
    data: { label: 'Pipeline.execute', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_parse_pipeline', source: 'nd_parse', target: 'nd_pipeline',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'Pipeline.execute',
    data: { label: 'Pipeline.execute', connectionType: 'sync', edgeVariant: 'dashed' },
  },
  {
    id: 'e_ingest_pipeline', source: 'nd_ingest', target: 'nd_pipeline',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'Pipeline.execute',
    data: { label: 'Pipeline.execute', connectionType: 'sync', edgeVariant: 'dashed' },
  },
  {
    id: 'e_pipeline_context', source: 'nd_pipeline', target: 'nd_context',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'abort · progress',
    data: { label: 'abort · progress', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_pipeline_domain', source: 'nd_pipeline', target: 'nd_domain',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'toDomainResult',
    data: { label: 'toDomainResult', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_pipeline_metrics', source: 'nd_pipeline', target: 'nd_metrics',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'stage timings',
    data: { label: 'stage timings', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // AI Mermaid flat stages
  {
    id: 'e_orch_concepts', source: 'nd_orchestrator', target: 'nd_concepts',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'user intent',
    data: { label: 'user intent', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_concepts_planner', source: 'nd_concepts', target: 'nd_planner',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'no template → LLM',
    data: { label: 'no template → LLM', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_planner_override', source: 'nd_planner', target: 'nd_layoutoverride',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'architecture plan',
    data: { label: 'architecture plan', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_override_materialize', source: 'nd_layoutoverride', target: 'nd_materialize',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'mermaid code',
    data: { label: 'mermaid code', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_materialize_score', source: 'nd_materialize', target: 'nd_score',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'RF nodes/edges',
    data: { label: 'RF nodes/edges', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_score_validate', source: 'nd_score', target: 'nd_aivalidate',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'diagram score',
    data: { label: 'diagram score', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_planner_keymgr', source: 'nd_planner', target: 'nd_keymgr',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'API key rotation',
    data: { label: 'API key rotation', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_validate_cache', source: 'nd_aivalidate', target: 'nd_diagcache',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'cache result',
    data: { label: 'cache result', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // Materialize uses mermaid pipeline
  {
    id: 'e_materialize_parse', source: 'nd_materialize', target: 'nd_parse',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'runMermaidPipeline',
    data: { label: 'runMermaidPipeline', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // Mermaid sequential stages
  {
    id: 'e_parse_validate', source: 'nd_parse', target: 'nd_validate',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'AST',
    data: { label: 'AST', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_validate_build', source: 'nd_validate', target: 'nd_build',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'validated AST',
    data: { label: 'validated AST', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_build_layout', source: 'nd_build', target: 'nd_layoutstage',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'RF objects',
    data: { label: 'RF objects', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_layout_size', source: 'nd_layoutstage', target: 'nd_size',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'positioned nodes',
    data: { label: 'positioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_size_final', source: 'nd_size', target: 'nd_finalval',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'sized graph',
    data: { label: 'sized graph', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_final_relayout', source: 'nd_finalval', target: 'nd_relayout',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'DomainResult',
    data: { label: 'DomainResult', connectionType: 'sync', edgeVariant: 'dashed' },
  },

  // Mermaid LayoutStage → shared layout
  {
    id: 'e_layoutstage_applyrf', source: 'nd_layoutstage', target: 'nd_applyrf',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'canonical layout',
    data: { label: 'canonical layout', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_applyrf_dagre', source: 'nd_applyrf', target: 'nd_dagre',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'primary engine',
    data: { label: 'primary engine', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_applyrf_elk', source: 'nd_applyrf', target: 'nd_elk',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'optional / presets',
    data: { label: 'optional / presets', connectionType: 'sync', edgeVariant: 'dashed' },
  },

  // Shared layout → canvas rendering
  {
    id: 'e_dagre_sysnode', source: 'nd_dagre', target: 'nd_sysnode',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'positioned nodes',
    data: { label: 'positioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_dagre_floatedge', source: 'nd_dagre', target: 'nd_floatedge',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'routed edges',
    data: { label: 'routed edges', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_sysnode_canvas', source: 'nd_sysnode', target: 'nd_canvas',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'rendered nodes',
    data: { label: 'rendered nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_floatedge_canvas', source: 'nd_floatedge', target: 'nd_canvas',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'rendered edges',
    data: { label: 'rendered edges', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_finalval_store', source: 'nd_finalval', target: 'nd_store',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'diagram data',
    data: { label: 'diagram data', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // Repo pipeline flat stages
  {
    id: 'e_ingest_github', source: 'nd_ingest', target: 'nd_github',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'fetch tarball',
    data: { label: 'fetch tarball', connectionType: 'async', edgeVariant: 'solid' },
  },
  {
    id: 'e_ingest_cache', source: 'nd_ingest', target: 'nd_cachecheck',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'snapshot',
    data: { label: 'snapshot', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_cache_analysis', source: 'nd_cachecheck', target: 'nd_analysis',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'cache miss',
    data: { label: 'cache miss', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_analysis_baseline', source: 'nd_analysis', target: 'nd_baseline',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'signals',
    data: { label: 'signals', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_baseline_classify', source: 'nd_baseline', target: 'nd_classify',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'seed graph',
    data: { label: 'seed graph', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_classify_extract', source: 'nd_classify', target: 'nd_extract',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'repo profile',
    data: { label: 'repo profile', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_extract_rel', source: 'nd_extract', target: 'nd_relationships',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'components',
    data: { label: 'components', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_rel_verify', source: 'nd_relationships', target: 'nd_verify',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'edges + workflows',
    data: { label: 'edges + workflows', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_verify_finalize', source: 'nd_verify', target: 'nd_finalize',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'verified graph',
    data: { label: 'verified graph', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_finalize_cachewrite', source: 'nd_finalize', target: 'nd_cachewrite',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'compiled result',
    data: { label: 'compiled result', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_finalize_repolayout', source: 'nd_finalize', target: 'nd_repolayout',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'RF objects',
    data: { label: 'RF objects', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_repolayout_applyrf', source: 'nd_repolayout', target: 'nd_applyrf',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'shared layout',
    data: { label: 'shared layout', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_classify_keymgr', source: 'nd_classify', target: 'nd_keymgr',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'LLM enrichment',
    data: { label: 'LLM enrichment', connectionType: 'async', edgeVariant: 'dashed' },
  },

  // Persistence
  {
    id: 'e_store_auth', source: 'nd_store', target: 'nd_auth',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'session token',
    data: { label: 'session token', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_store_db', source: 'nd_store', target: 'nd_db',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'save/load diagrams',
    data: { label: 'save/load diagrams', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_store_realtime', source: 'nd_store', target: 'nd_realtime',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'realtime presence',
    data: { label: 'realtime presence', connectionType: 'stream', edgeVariant: 'solid' },
  },

  // LLM providers
  {
    id: 'e_keymgr_groq', source: 'nd_keymgr', target: 'nd_groq',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'primary API call',
    data: { label: 'primary API call', connectionType: 'async', edgeVariant: 'solid' },
  },
  {
    id: 'e_keymgr_openrouter', source: 'nd_keymgr', target: 'nd_openrouter',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'fallback on 429',
    data: { label: 'fallback on 429', connectionType: 'async', edgeVariant: 'dashed' },
  },
];
