import type { Connection, Edge, Node, NodeChange, EdgeChange } from 'reactflow';
import type { CloudProviderToggle } from '@/lib/cloudIcons/types';

export type FitViewOptions = { padding?: number; duration?: number; maxZoom?: number };

export interface GuideLine {
  orientation: 'h' | 'v';
  position: number;
  spacingArrows?: { from: number; to: number };
}

export interface NodeData {
  label: string;
  category: string;
  layer?: string;
  componentType?: string;
  typeId?: string;
  color?: string;
  icon?: string;
  iconUrl?: string;
  iconSource?: string;
  description?: string;
  tech?: string;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  isExternal?: boolean;
  hideTierTag?: boolean;
  sublabel?: string;
  subtitle?: string;
  hasError?: boolean;
  accentColor?: string;
  technology?: string;
  nodeWidth?: number;
  shape?: string;
  serviceType?: string;
  groupLabel?: string;
  groupColor?: string;
  labelManuallyEdited?: boolean;
  /** Enter inline label edit when the node mounts (edge-drop create). */
  autoStartLabelEdit?: boolean;
}

export interface CanvasTab {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt?: number;
  createdAt?: number;
  isOpen?: boolean;
  isPinned?: boolean;
  isFavorite?: boolean;
  lastAccessedAt?: number;
  thumbnail?: string;
  /** Render-only view preference: AWS/Azure icon set or Off. Not in Mermaid IR. */
  cloudProvider?: CloudProviderToggle;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

export interface DiagramState {
  // ── Multi-canvas ──────────────────────────────────────────────────────────
  canvases: CanvasTab[];
  activeCanvasId: string;
  openCanvasIds: string[];
  nodes: Node[];
  edges: Edge[];

  // ── Sequence Diagrams ───────────────────────────────────────────────────
  sequenceDiagrams: Record<string, { mermaidSyntax: string; title: string }>;
  setSequenceDiagram: (canvasId: string, mermaidSyntax: string, title: string) => void;
  clearSequenceDiagram: (canvasId: string) => void;
  importSequenceDiagram: (mermaidSyntax: string, title: string) => void;

  getRandomAnimalName: () => string;
  addCanvas: (customName?: string, canvasId?: string) => string;
  duplicateCanvas: (id: string) => string | undefined;
  removeCanvas: (id: string) => void;
  switchCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;
  openCanvas: (id: string) => void;
  closeCanvas: (id: string) => void;
  togglePinCanvas: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getOpenCanvases: () => CanvasTab[];
  getVisibleCanvases: () => CanvasTab[];
  getOverflowCanvases: () => CanvasTab[];
  getActiveCanvasId: () => string;

  // ── User / Auth ───────────────────────────────────────────────────────────
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  loadCanvasesFromDB: () => Promise<void>;
  saveCanvasToDB: (canvasId: string) => void;
  savingState: 'idle' | 'saving' | 'saved';
  setSavingState: (s: 'idle' | 'saving' | 'saved') => void;

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeId: (id: string | null) => void;

  // ── UI state ──────────────────────────────────────────────────────────────
  guideLines: GuideLine[];
  edgeAnimations: boolean;
  showGrid: boolean;
  diagramChromeMode: 'edit' | 'present';
  diagramStyleTheme: string;
  darkMode: boolean;
  sidebarOpen: boolean;
  canvasMode: 'empty' | 'editing' | 'template';
  activeLayoutPresetId: string;
  detailLevel: 1 | 2 | 3;
  setGuideLines: (lines: GuideLine[]) => void;
  toggleEdgeAnimations: () => void;
  toggleGrid: () => void;
  cloudProvider: CloudProviderToggle;
  setCloudProvider: (toggle: CloudProviderToggle) => void;
  setDiagramChromeMode: (mode: 'edit' | 'present') => void;
  setDiagramStyleTheme: (theme: string) => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCanvasMode: (mode: 'empty' | 'editing' | 'template') => void;
  setActiveLayoutPresetId: (id: string) => void;
  setDetailLevel: (level: 1 | 2 | 3) => void;
  isPenModeActive: boolean;
  setPenModeActive: (active: boolean) => void;
  clarityReport?: import('@/lib/features/clarityCompiler').ClarityReport;

  // ── History ───────────────────────────────────────────────────────────────
  past: HistoryEntry[];
  future: HistoryEntry[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // ── Node/edge operations ──────────────────────────────────────────────────
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (
    node: Node<NodeData> | string,
    label?: string,
    category?: string,
    color?: string,
    icon?: string,
    technology?: string,
    position?: { x: number; y: number }
  ) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  updateNodeSize: (id: string, size: { width?: number; height?: number }) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  deleteEdge: (edgeId: string) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  addNodeOnEdgeDrop: (params: {
    originNodeId: string;
    originHandleType: 'source' | 'target' | null;
    position: { x: number; y: number };
  }) => string;
  importDiagram: (nodes: Node[], edges: Edge[]) => void;
  clearDiagram: () => void;
  deleteSelected: () => void;
  selectAll: () => void;
  createGroup: (parentId?: string) => void;
  ungroupNodes: (groupId: string) => void;
  moveToGroup: (nodeId: string, groupId: string | null) => void;
  loadTemplate: (nodes: Node[], edges: Edge[]) => void;
  loadDefaultArchitecture: () => void;
  alignConnectedNodes: () => void;
  recalculateHandles: (nodesOverride?: Node[]) => void;

  // ── Fit view ──────────────────────────────────────────────────────────────
  fitView: (options?: FitViewOptions) => void;

  // ── Edge editing ──────────────────────────────────────────────────────────
  editingEdgeId: string | null;
  setEditingEdgeId: (id: string | null) => void;
  pendingEditEdgeId: string | null;
  setPendingEditEdgeId: (id: string | null) => void;
  pendingLabelEdgeId: string | null;
  setPendingLabelEdgeId: (id: string | null) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;

  // ── AI Streaming ──────────────────────────────────────────────────────────
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  appendNode: (node: Node) => void;
  appendEdge: (edge: Edge) => void;

  // ── AI Pipeline Generation Status ──────────────────────────────────────────
  pipelineStatus: 'idle' | 'generating' | 'done' | 'error';
  pipelineError: string | null;
  startGeneration: () => void;
  markPipelineDone: () => void;
  markPipelineError: (message: string) => void;
  clearPipelineStatus: () => void;
}
