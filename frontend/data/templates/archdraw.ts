import { Node, Edge } from 'reactflow';

export const archdrawNodes: Node[] = [
  // ═══════════════════════════════════════════════════════════
  // GROUP: Client Tier (Browser) — Next.js React App
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_client',
    type: 'groupNode',
    position: { x: 0, y: 0 },
    data: { label: 'Client Tier (Browser)', groupLabel: 'Client Tier (Browser)', isGroup: true, color: '#3b82f6' },
    style: { width: 1100, height: 520 },
    zIndex: -1,
    width: 1100,
    height: 520,
  },
  {
    id: 'nd_webui',
    type: 'shapeNode',
    position: { x: 60, y: 80 },
    data: {
      label: 'Web UI Layer', subtitle: 'Next.js React App',
      shape: 'rounded-rectangle', nodeWidth: 220, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#3b82f6',
      category: 'Client & Entry', icon: 'Monitor',
    },
    width: 220, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_canvas',
    type: 'shapeNode',
    position: { x: 380, y: 80 },
    data: {
      label: 'React Flow Canvas', subtitle: 'Interactive Diagram Renderer',
      shape: 'rounded-rectangle', nodeWidth: 220, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#3b82f6',
      category: 'Client & Entry', icon: 'Workflow',
    },
    width: 220, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_editor',
    type: 'shapeNode',
    position: { x: 700, y: 80 },
    data: {
      label: 'Code Editor', subtitle: 'CodeMirror Mermaid Editor',
      shape: 'rounded-rectangle', nodeWidth: 220, nodeHeight: 100,
      serviceType: 'service', typeId: 'service', color: '#3b82f6',
      category: 'Client & Entry', icon: 'Code',
    },
    width: 220, height: 100, parentNode: 'grp_client', extent: 'parent',
  },
  {
    id: 'nd_store',
    type: 'shapeNode',
    position: { x: 380, y: 280 },
    data: {
      label: 'Zustand Store', subtitle: 'Client State + Persistence',
      shape: 'cylinder', nodeWidth: 220, nodeHeight: 100,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Data Storage', icon: 'Database',
    },
    width: 220, height: 100, parentNode: 'grp_client', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: AI Pipeline — LLM Planning & Response Processing
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_ai',
    type: 'groupNode',
    position: { x: 0, y: 600 },
    data: { label: 'AI Pipeline', groupLabel: 'AI Pipeline', isGroup: true, color: '#ec4899' },
    style: { width: 1100, height: 380 },
    zIndex: -1,
    width: 1100,
    height: 380,
  },
  {
    id: 'nd_prompt',
    type: 'shapeNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'Prompt Handler', subtitle: 'User Input Processing',
      shape: 'rounded-rectangle', nodeWidth: 220, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#ec4899',
      category: 'Compute', icon: 'MessageSquare',
    },
    width: 220, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_concepts',
    type: 'shapeNode',
    position: { x: 380, y: 60 },
    data: {
      label: 'Concept Detector', subtitle: 'Template Fast Path',
      shape: 'diamond', nodeWidth: 200, nodeHeight: 90,
      serviceType: 'compute', typeId: 'microservice', color: '#ec4899',
      category: 'Compute', icon: 'Search',
    },
    width: 200, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_planner',
    type: 'shapeNode',
    position: { x: 660, y: 60 },
    data: {
      label: 'LLM Planner', subtitle: 'Stage 1 — Architecture Planner',
      shape: 'rounded-rectangle', nodeWidth: 220, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#ec4899',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 220, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_keymgr',
    type: 'shapeNode',
    position: { x: 60, y: 240 },
    data: {
      label: 'API Key Manager', subtitle: 'Multi-Key Rotation (10 Groq + 3 OpenRouter)',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#ec4899',
      category: 'Auth & Security', icon: 'Key',
    },
    width: 260, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_cache',
    type: 'shapeNode',
    position: { x: 400, y: 240 },
    data: {
      label: 'Diagram Cache', subtitle: 'LRU In-Memory (20 entries, 5m TTL)',
      shape: 'cylinder', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Caching', icon: 'Layers',
    },
    width: 260, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },
  {
    id: 'nd_validator',
    type: 'shapeNode',
    position: { x: 740, y: 240 },
    data: {
      label: 'Response Validator', subtitle: 'JSON Parse + Score (0-100)',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#ec4899',
      category: 'Compute', icon: 'CheckCircle',
    },
    width: 260, height: 90, parentNode: 'grp_ai', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Mermaid Processing — 5-Stage Sync Pipeline
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_mermaid',
    type: 'groupNode',
    position: { x: 1200, y: 0 },
    data: { label: 'Mermaid Processing Pipeline', groupLabel: 'Mermaid Processing Pipeline', isGroup: true, color: '#14b8a6' },
    style: { width: 360, height: 980 },
    zIndex: -1,
    width: 360,
    height: 980,
  },
  {
    id: 'nd_parse',
    type: 'shapeNode',
    position: { x: 60, y: 80 },
    data: {
      label: 'Mermaid Parser', subtitle: 'Stage 1 — Text to AST',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'FileCode',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_astval',
    type: 'shapeNode',
    position: { x: 60, y: 230 },
    data: {
      label: 'AST Validator', subtitle: 'Stage 2 — Schema Check',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'ShieldCheck',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_rfbuild',
    type: 'shapeNode',
    position: { x: 60, y: 380 },
    data: {
      label: 'ReactFlow Builder', subtitle: 'Stage 3 — Nodes & Edges',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'Workflow',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_nodeclf',
    type: 'shapeNode',
    position: { x: 60, y: 530 },
    data: {
      label: 'Node Classifier', subtitle: 'Service Type + Category + Icon',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'Tag',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_edgeclf',
    type: 'shapeNode',
    position: { x: 60, y: 680 },
    data: {
      label: 'Edge Classifier', subtitle: 'Importance + Sync/Async + Protocol',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'GitBranch',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },
  {
    id: 'nd_dagsize',
    type: 'shapeNode',
    position: { x: 60, y: 830 },
    data: {
      label: 'Subgraph Sizing', subtitle: 'Stage 5 — Container Dimensions',
      shape: 'rounded-rectangle', nodeWidth: 240, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#14b8a6',
      category: 'Compute', icon: 'Maximize2',
    },
    width: 240, height: 90, parentNode: 'grp_mermaid', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Layout Engine — Dagre + ELK
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_layout',
    type: 'groupNode',
    position: { x: 1680, y: 0 },
    data: { label: 'Layout Engine', groupLabel: 'Layout Engine', isGroup: true, color: '#8b5cf6' },
    style: { width: 360, height: 440 },
    zIndex: -1,
    width: 360,
    height: 440,
  },
  {
    id: 'nd_dagre',
    type: 'shapeNode',
    position: { x: 60, y: 80 },
    data: {
      label: 'Dagre Layout', subtitle: 'Primary — Compound Graph, 20px Grid Snap',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#8b5cf6',
      category: 'Compute', icon: 'Layout',
    },
    width: 260, height: 90, parentNode: 'grp_layout', extent: 'parent',
  },
  {
    id: 'nd_elk',
    type: 'shapeNode',
    position: { x: 60, y: 230 },
    data: {
      label: 'ELK Layout', subtitle: 'Alternate — Eclipse Layout Kernel',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#8b5cf6',
      category: 'Compute', icon: 'LayoutTemplate',
    },
    width: 260, height: 90, parentNode: 'grp_layout', extent: 'parent',
  },
  {
    id: 'nd_colldetect',
    type: 'shapeNode',
    position: { x: 60, y: 380 },
    data: {
      label: 'Collision Detection', subtitle: 'Node Overlap Resolution',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#8b5cf6',
      category: 'Compute', icon: 'ShieldAlert',
    },
    width: 260, height: 90, parentNode: 'grp_layout', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Edge Routing — Obstacle-Aware Connection Paths
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_edge',
    type: 'groupNode',
    position: { x: 1680, y: 520 },
    data: { label: 'Edge Routing', groupLabel: 'Edge Routing', isGroup: true, color: '#f59e0b' },
    style: { width: 360, height: 460 },
    zIndex: -1,
    width: 360,
    height: 460,
  },
  {
    id: 'nd_handlescorer',
    type: 'shapeNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'Handle Pair Scorer', subtitle: 'Optimal Source/Target Selection',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#f59e0b',
      category: 'Compute', icon: 'Crosshair',
    },
    width: 260, height: 90, parentNode: 'grp_edge', extent: 'parent',
  },
  {
    id: 'nd_routebuilder',
    type: 'shapeNode',
    position: { x: 60, y: 210 },
    data: {
      label: 'Edge Route Builder', subtitle: 'Waypoint + SmoothStep SVG Generation',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#f59e0b',
      category: 'Compute', icon: 'Route',
    },
    width: 260, height: 90, parentNode: 'grp_edge', extent: 'parent',
  },
  {
    id: 'nd_colfreepath',
    type: 'shapeNode',
    position: { x: 60, y: 360 },
    data: {
      label: 'Collision-Free Path', subtitle: 'A* Grid Search + Cohen-Sutherland',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 90,
      serviceType: 'service', typeId: 'service', color: '#f59e0b',
      category: 'Compute', icon: 'Waypoints',
    },
    width: 260, height: 90, parentNode: 'grp_edge', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Canvas Rendering — Custom React Flow Components
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_render',
    type: 'groupNode',
    position: { x: 2160, y: 0 },
    data: { label: 'Canvas Rendering', groupLabel: 'Canvas Rendering', isGroup: true, color: '#06b6d4' },
    style: { width: 360, height: 440 },
    zIndex: -1,
    width: 360,
    height: 440,
  },
  {
    id: 'nd_sysnode',
    type: 'shapeNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'SystemNode', subtitle: 'Service / Compute Components',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#06b6d4',
      category: 'Client & Entry', icon: 'Box',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },
  {
    id: 'nd_shapenode',
    type: 'shapeNode',
    position: { x: 60, y: 190 },
    data: {
      label: 'ShapeNode', subtitle: 'Cylinder, Diamond, Hexagon',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#06b6d4',
      category: 'Client & Entry', icon: 'Shapes',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },
  {
    id: 'nd_floatedge',
    type: 'shapeNode',
    position: { x: 60, y: 320 },
    data: {
      label: 'SimpleFloatingEdge', subtitle: 'Custom Edge with Dynamic Handles',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#06b6d4',
      category: 'Client & Entry', icon: 'Spline',
    },
    width: 260, height: 80, parentNode: 'grp_render', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP: Supabase Backend — Database, Auth & Realtime
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_backend',
    type: 'groupNode',
    position: { x: 2160, y: 520 },
    data: { label: 'Supabase Backend', groupLabel: 'Supabase Backend', isGroup: true, color: '#10b981' },
    style: { width: 360, height: 460 },
    zIndex: -1,
    width: 360,
    height: 460,
  },
  {
    id: 'nd_auth',
    type: 'shapeNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'Authentication', subtitle: 'OAuth + Row Level Security',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'auth', typeId: 'auth_service', color: '#10b981',
      category: 'Auth & Security', icon: 'Shield',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },
  {
    id: 'nd_db',
    type: 'shapeNode',
    position: { x: 60, y: 190 },
    data: {
      label: 'PostgreSQL Database', subtitle: 'Diagrams, Profiles, Versions, Activity Log',
      shape: 'cylinder', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'database', typeId: 'database', color: '#1e293b',
      category: 'Data Storage', icon: 'Database',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },
  {
    id: 'nd_realtime',
    type: 'shapeNode',
    position: { x: 60, y: 320 },
    data: {
      label: 'Realtime Sync', subtitle: 'Live Collaboration + Shared Canvases',
      shape: 'rounded-rectangle', nodeWidth: 260, nodeHeight: 80,
      serviceType: 'service', typeId: 'service', color: '#10b981',
      category: 'Messaging & Events', icon: 'Radio',
    },
    width: 260, height: 80, parentNode: 'grp_backend', extent: 'parent',
  },

  // ═══════════════════════════════════════════════════════════
  // EXTERNAL: AI Providers — LLM API Endpoints
  // ═══════════════════════════════════════════════════════════
  {
    id: 'grp_providers',
    type: 'groupNode',
    position: { x: 1200, y: 1060 },
    data: { label: 'External AI Providers', groupLabel: 'External AI Providers', isGroup: true, color: '#f97316' },
    style: { width: 800, height: 220 },
    zIndex: -1,
    width: 800,
    height: 220,
  },
  {
    id: 'nd_groq',
    type: 'shapeNode',
    position: { x: 60, y: 60 },
    data: {
      label: 'Groq', subtitle: 'Primary — Llama 3.3 70B / Llama 4 Scout / Mixtral',
      shape: 'hexagon', nodeWidth: 320, nodeHeight: 90,
      serviceType: 'external', typeId: 'llm_api', color: '#f97316',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 320, height: 90, parentNode: 'grp_providers', extent: 'parent',
  },
  {
    id: 'nd_openrouter',
    type: 'shapeNode',
    position: { x: 440, y: 60 },
    data: {
      label: 'OpenRouter', subtitle: 'Fallback — Claude 3.5 Sonnet / GPT Models',
      shape: 'hexagon', nodeWidth: 320, nodeHeight: 90,
      serviceType: 'external', typeId: 'llm_api', color: '#f97316',
      category: 'AI / ML', icon: 'Brain',
    },
    width: 320, height: 90, parentNode: 'grp_providers', extent: 'parent',
  },
];

export const archdrawEdges: Edge[] = [
  // ───────────────────────────────────────────────────────────
  // Client Tier internal flow
  // ───────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────
  // Client Tier → AI Pipeline (user triggers generation)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_webui_prompt', source: 'nd_webui', target: 'nd_prompt',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'user prompt',
    data: { label: 'user prompt', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_editor_store', source: 'nd_editor', target: 'nd_store',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'mermaid code sync',
    data: { label: 'mermaid code sync', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // AI Pipeline internal flow
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_prompt_concepts', source: 'nd_prompt', target: 'nd_concepts',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'classify intent',
    data: { label: 'classify intent', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_concepts_planner', source: 'nd_concepts', target: 'nd_planner',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'no template match → LLM',
    data: { label: 'no template match → LLM', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_planner_keymgr', source: 'nd_planner', target: 'nd_keymgr',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'API key rotation',
    data: { label: 'API key rotation', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_planner_validator', source: 'nd_planner', target: 'nd_validator',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'raw LLM response',
    data: { label: 'raw LLM response', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_validator_cache', source: 'nd_validator', target: 'nd_cache',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'cache result',
    data: { label: 'cache result', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // AI Pipeline → Mermaid Processing (mermaid code handoff)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_planner_parse', source: 'nd_planner', target: 'nd_parse',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'mermaid code',
    data: { label: 'mermaid code', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Mermaid Processing Pipeline (sequential 5-stage)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_parse_astval', source: 'nd_parse', target: 'nd_astval',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'AST output',
    data: { label: 'AST output', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_astval_rfbuild', source: 'nd_astval', target: 'nd_rfbuild',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'validated AST',
    data: { label: 'validated AST', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_rfbuild_nodeclf', source: 'nd_rfbuild', target: 'nd_nodeclf',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'unpositioned nodes',
    data: { label: 'unpositioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_nodeclf_edgeclf', source: 'nd_nodeclf', target: 'nd_edgeclf',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'classified nodes',
    data: { label: 'classified nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Mermaid Processing → Layout Engine (positioned nodes)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_rfbuild_dagre', source: 'nd_rfbuild', target: 'nd_dagre',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'dagre layout (primary)',
    data: { label: 'dagre layout (primary)', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_rfbuild_elk', source: 'nd_rfbuild', target: 'nd_elk',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'ELK layout (alternate)',
    data: { label: 'ELK layout (alternate)', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_dagre_colldetect', source: 'nd_dagre', target: 'nd_colldetect',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'positioned nodes',
    data: { label: 'positioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_elk_colldetect', source: 'nd_elk', target: 'nd_colldetect',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'positioned nodes',
    data: { label: 'positioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Layout Engine → Edge Routing (positioned + collision-free)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_colldetect_handlescorer', source: 'nd_colldetect', target: 'nd_handlescorer',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'resolved positions',
    data: { label: 'resolved positions', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Edge Routing internal flow
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_handlescorer_routebuilder', source: 'nd_handlescorer', target: 'nd_routebuilder',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'optimal handle pairs',
    data: { label: 'optimal handle pairs', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_routebuilder_colfreepath', source: 'nd_routebuilder', target: 'nd_colfreepath',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'candidate waypoints',
    data: { label: 'candidate waypoints', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Edge Routing → Canvas Rendering (SVG paths + positioned nodes)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_colfreepath_floatedge', source: 'nd_colfreepath', target: 'nd_floatedge',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'collision-free SVG',
    data: { label: 'collision-free SVG', connectionType: 'sync', edgeVariant: 'solid' },
  },
  {
    id: 'e_colldetect_sysnode', source: 'nd_colldetect', target: 'nd_sysnode',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'positioned nodes',
    data: { label: 'positioned nodes', connectionType: 'sync', edgeVariant: 'solid' },
  },

  // ───────────────────────────────────────────────────────────
  // Canvas Rendering → Client Store (rendered diagram state)
  // ───────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────
  // Client → Supabase Backend (persistence + auth + realtime)
  // ───────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────
  // AI Pipeline → External Providers (LLM API calls)
  // ───────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────
  // Mermaid Processing → Store (diagram data return path)
  // ───────────────────────────────────────────────────────────
  {
    id: 'e_dagsize_store', source: 'nd_dagsize', target: 'nd_store',
    sourceHandle: null, targetHandle: null, type: 'simpleFloating',
    label: 'sized diagram data',
    data: { label: 'sized diagram data', connectionType: 'sync', edgeVariant: 'solid' },
  },
];
