import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from 'reactflow';
import type { CloudProviderToggle } from '@/lib/cloudIcons/types';
import { componentRegistry } from '@/lib/componentRegistry';
import { STORAGE_KEYS } from '@/lib/config';
import { toast } from 'sonner';
import { applyThemeChange } from '@/lib/themeBridge';
import { serializedStorage, migrateLegacyStorage } from '@/lib/storage/localStorage';

const isBrowser = typeof window !== 'undefined';
const MAX_GUEST_CANVASES = 1;
const MAX_GUEST_NODES = 25;
const MAX_AUTH_NODES = 50;

// --- Migration for duplicate nodes/edges from legacy flat schema ---
migrateLegacyStorage();

import { addEdge, applyNodeChanges, applyEdgeChanges, MarkerType, Position } from 'reactflow';
import { getObstacleAwareHandles } from '@/lib/features/dynamicHandles';
import { processEdgeManagement } from '@/lib/features/edgeManagement';
import { mergeParallelEdges } from '@/lib/utils/mergeParallelEdges';
import { runClarityCompiler } from '@/lib/features/clarityCompiler';
import { saveUserCanvas as apiSaveUserCanvas, deleteUserCanvasApi as apiDeleteUserCanvas, fetchUserCanvases as apiGetUserCanvases } from '@/lib/api-client';
import { DEFAULT_EDGE_TYPE, type EdgeType } from '@/data/edgeTypes';
import { getNodeShape } from '@/lib/nodeShapes';
import { getStrictPortConfig } from '@/lib/componentPorts';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import logger from '@/lib/logger';
import { EDGE_CONFIG, STORAGE_KEY, STORAGE_VERSION, NODE_CONFIG } from '@/lib/config';
import { createNode, createEdge } from '@/lib/factory';
import { applyLayoutPreset } from '@/lib/canvas/applyLayout';
import { LAYOUT_PRESETS, type LayoutPreset } from '@/lib/canvas/layoutPresets';
import {
  layoutDiagramViaMermaid,
  directionFromPresetId,
} from '@/lib/mermaid/relayout';
import { migrateEdgesToSmoothstep } from '@/lib/utils/edgeMigration';
import { resolveNodeCollisions } from '@/src/utils/resolveNodeCollisions';

const RESERVED_LAYER_LABELS = new Set([
  'presentation', 'presentation layer',
  'gateway', 'gateway layer',
  'application', 'application layer',
  'data', 'data layer',
  'async', 'async layer',
  'observability', 'observability layer',
  'external', 'external layer',
]);

function stripReservedLayerNodes(nodes: Node[]): Node[] {
  const result: Node[] = [];
  const labelMap = new Map<string, Node>();
  
  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined;
    const label = typeof data?.label === 'string' ? data.label.toLowerCase().trim() : '';
    const isGroup = data?.isGroup === true;
    
    if (isGroup) {
      result.push(node);
      continue;
    }
    
    if (RESERVED_LAYER_LABELS.has(label)) {
      logger.log(`[Store] Stripping reserved layer node: "${data?.label}" (${node.id})`);
      continue;
    }
    
    result.push(node);
  }
  
  return result;
}

// Module-level fitView callback — set by Canvas on mount, avoids circular imports
type FitViewOptions = { padding?: number; duration?: number; maxZoom?: number };
let fitViewCallback: ((opts?: FitViewOptions) => void) | null = null;
export function registerFitViewCallback(fn: (opts?: FitViewOptions) => void) {
  fitViewCallback = fn;
}

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

interface DiagramState {
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
  saveCanvasToDB: (canvasId: string) => void; // debounced
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
  /** edit = decorative chrome; present = quiet architecture (also used for export). */
  diagramChromeMode: 'edit' | 'present';
  /** Named diagram theme pack (slate / forest-green / …). */
  diagramStyleTheme: string;
  darkMode: boolean;
  sidebarOpen: boolean;
  canvasMode: 'empty' | 'editing' | 'template';
  activeLayoutPresetId: string;
  detailLevel: 1 | 2 | 3;
  setGuideLines: (lines: GuideLine[]) => void;
  toggleEdgeAnimations: () => void;
  toggleGrid: () => void;
  /** Active cloud provider icon set for the current diagram ('off' | 'aws' | 'azure'). */
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
  toggleLayoutDirection: () => Promise<void>;
  applyLayoutPresetById: (presetId: string) => Promise<void>;

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
  addNode: (node: Node<NodeData> | string, label?: string, category?: string, color?: string, icon?: string, technology?: string, position?: { x: number; y: number }) => void;
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
  recalculateHandles: () => void;

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

  // ── AI Streaming (real-time canvas building) ──────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(name: string, id?: string): CanvasTab {
  const finalId = id ?? (isBrowser ? crypto.randomUUID() : 'canvas-1');

  return { 
    id: finalId, 
    name, 
    nodes: [], 
    edges: [], 
    cloudProvider: 'off',
    createdAt: Date.now(),
    updatedAt: Date.now() 
  };
}

const INITIAL_CANVAS = makeCanvas('Elephant');

function syncActiveCanvas(
  canvases: CanvasTab[],
  activeCanvasId: string,
  nodes: Node[],
  edges: Edge[]
): CanvasTab[] {
  return canvases.map((c) =>
    c.id === activeCanvasId ? { ...c, nodes, edges, updatedAt: Date.now() } : c
  );
}

const KNOWN_NODE_TYPES = new Set([
  'systemNode',
  'architectureNode',
  'baseNode',
  'databaseNode',
  'cacheNode',
  'shapeNode',
  'groupNode',
  'group',
  'frameNode',
  'serviceNode',
  'textLabelNode',
  'annotationNode',
  'messageBrokerNode',
  'customNode',
]);

const KNOWN_EDGE_TYPES = new Set(['custom', 'simpleFloating', 'default']);

function normalizeNodeType(type?: string): string {
  if (!type) return 'systemNode';
  if (type === 'system') return 'systemNode';
  if (!KNOWN_NODE_TYPES.has(type)) return 'systemNode';
  return type;
}

function normalizeNodes(nodes: Node[]): Node[] {
  // Create a set of valid node IDs for parent validation
  const validNodeIds = new Set(nodes.map(n => n.id));
  
  return nodes.map((node) => {
    const parentId = node.parentId || (node as { parentNode?: string }).parentNode;
    const isValidParent = parentId && validNodeIds.has(parentId);
    
    return {
      ...node,
      type: normalizeNodeType(node.type as string | undefined),
      // Only set parent-related fields if parent actually exists
      ...(isValidParent ? { parentId, parentNode: parentId, extent: node.extent || 'parent' as const } : {
        parentId: undefined,
        parentNode: undefined,
        extent: undefined
      }),
    };
  });
}

function normalizeEdge(edge: Edge): Edge {
  const finalType = edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : 'simpleFloating';
  return {
    ...edge,
    type: finalType,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    markerEnd: edge.markerEnd ?? {
      type: EDGE_CONFIG.markerType,
      color: EDGE_CONFIG.strokeColor,
      width: 20,
      height: 20,
    },
  };
}

function positionToSide(pos: Position): string {
  if (pos === Position.Left) return 'left';
  if (pos === Position.Right) return 'right';
  if (pos === Position.Top) return 'top';
  return 'bottom';
}

function distributeTargetHandles(nodes: Node[], edges: Edge[]): Edge[] {
  // Run visual edge management (bundling / collapsing)
  const { edges: managedEdges } = processEdgeManagement(nodes, edges);
  const normalized = normalizeEdges(managedEdges);

  return normalized.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);

    if (!sourceNode) return edge;

    if (edge.source === edge.target) {
      return {
        ...edge,
        sourceHandle: 'source-top',
        targetHandle: 'target-right',
        type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : 'simpleFloating',
      };
    }

    const targetNode = nodes.find(n => n.id === edge.target);
    if (!targetNode) {
      return {
        ...edge,
        sourceHandle: null,
        targetHandle: null,
        type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : 'simpleFloating',
      };
    }

    const sPos = getAbsolutePosition(sourceNode, nodes);
    const tPos = getAbsolutePosition(targetNode, nodes);

    const sWidth = sourceNode.width ?? (sourceNode.data as { nodeWidth?: number })?.nodeWidth ?? 180;
    const sHeight = sourceNode.height ?? (sourceNode.data as { nodeHeight?: number })?.nodeHeight ?? 70;
    const tWidth = targetNode.width ?? (targetNode.data as { nodeWidth?: number })?.nodeWidth ?? 180;
    const tHeight = targetNode.height ?? (targetNode.data as { nodeHeight?: number })?.nodeHeight ?? 70;

    const sourceRect = { x: sPos.x, y: sPos.y, width: sWidth, height: sHeight };
    const targetRect = { x: tPos.x, y: tPos.y, width: tWidth, height: tHeight };

    const intermediateNodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    const excludedIds = new Set([edge.source, edge.target]);

    for (const node of nodes) {
      if (excludedIds.has(node.id)) continue;
      const isGroup =
        node.type === 'groupNode' ||
        node.type === 'frameNode' ||
        node.type === 'group' ||
        node.type === 'demoGroup' ||
        (node.data as { isGroup?: boolean })?.isGroup === true;
      if (isGroup) continue;

      const pos = getAbsolutePosition(node, nodes);
      const w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? 180;
      const h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? 70;
      intermediateNodeRects.set(node.id, { id: node.id, x: pos.x, y: pos.y, w, h });
    }

    const activePreset = typeof useDiagramStore !== 'undefined' ? useDiagramStore.getState()?.activeLayoutPresetId : 'layered-lr';
    const direction = activePreset === 'layered-tb' ? 'TD' : 'LR';

    const handles = getObstacleAwareHandles(
      sourceRect,
      targetRect,
      intermediateNodeRects.size > 0 ? intermediateNodeRects : undefined,
      excludedIds,
      edge.id,
      edge.source,
      edge.target,
      edge.data,
      sourceNode.data?.serviceType,
      targetNode.data?.serviceType,
      direction
    );

    return {
      ...edge,
      sourceHandle: `source-${positionToSide(handles.sourcePosition)}`,
      targetHandle: `target-${positionToSide(handles.targetPosition)}`,
      type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : 'simpleFloating',
    };
  });
}

function getAbsolutePosition(node: Node, nodes: Node[]): { x: number; y: number } {
  let x = node.position?.x ?? 0;
  let y = node.position?.y ?? 0;
  let current = node;
  const visited = new Set<string>([node.id]);
  while (current.parentId || (current as { parentNode?: string }).parentNode) {
    const pId = current.parentId || (current as { parentNode?: string }).parentNode;
    if (!pId || visited.has(pId)) break;
    visited.add(pId);
    const parent = nodes.find(n => n.id === pId);
    if (!parent || !parent.position) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

function normalizeEdges(edges: Edge[]): Edge[] {
  const migrated = migrateEdgesToSmoothstep(edges);
  
  // Clean up legacy duplicate keys that might be stuck in localStorage
  const seenIds = new Set<string>();
  const deduplicated = migrated.map(edge => {
    let id = edge.id;
    while (seenIds.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 8)}`;
    }
    seenIds.add(id);
    return { ...edge, id };
  });

  return mergeParallelEdges(deduplicated.map(normalizeEdge));
}

function sanitizeNodes(nodes: Node[]): Node[] {
  return nodes.map(node => {
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      node.data?.isGroup === true;

    if (isGroup) {
      return {
        ...node,
        type: node.type || 'groupNode',
        data: {
          label: node.data?.label || node.data?.groupLabel || 'Group',
          groupLabel: node.data?.groupLabel || node.data?.label || 'Group',
          ...node.data,
          isGroup: true,
        },
      };
    }

    const hasRequired =
      node.data?.typeId &&
      node.data?.color &&
      node.data?.category &&
      node.data?.icon;

    if (!hasRequired) {
      logger.warn(`[sanitize] Node ${node.id} missing fields. Sanitizing in-place.`);
      const data = node.data || {};
      const typeId = (data as { typeId?: string }).typeId ?? 'default';
      const def = componentRegistry.get(typeId);
      return {
        ...node,
        type: node.type || 'systemNode',
        data: {
          typeId,
          label: data.label ?? def?.label ?? 'Unnamed',
          color: data.color ?? def?.color ?? '#6366f1',
          category: data.category ?? def?.category ?? 'default',
          icon: data.icon ?? def?.icon ?? 'Box',
          ...data,
        },
      };
    }
    return node;
  });
}

function sanitizeEdges(edges: Edge[]): Edge[] {
  return edges.map(edge => {
    const stroke = edge.style?.stroke || '#94a3b8';
    return {
      ...edge,
      type: edge.type || 'smoothstep',
      markerEnd: edge.markerEnd || {
        type: MarkerType.ArrowClosed,
        color: typeof stroke === 'string' ? stroke : '#94a3b8',
      },
      style: {
        strokeWidth: 1.5,
        stroke,
        ...edge.style,
      },
    };
  });
}

function mergeCanvases(localCanvases: CanvasTab[], dbCanvases: CanvasTab[]): CanvasTab[] {
  const merged = new Map<string, CanvasTab>();

  // Add all DB canvases first
  for (const c of dbCanvases) {
    if (!c.id) continue;
    merged.set(c.id, c);
  }

  // Merge local canvases, keeping the more recently updated version
  for (const local of localCanvases) {
    if (!local.id) continue;
    const existing = merged.get(local.id);
    if (!existing) {
      // New canvas not in DB yet - keep it
      merged.set(local.id, local);
    } else {
      // Canvas exists in both - keep the more recent version
      const localTime = local.updatedAt || 0;
      const dbTime = existing.updatedAt || 0;
      if (localTime > dbTime) {
        merged.set(local.id, { ...local, isOpen: existing.isOpen, isPinned: existing.isPinned });
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
}
// ── Debounced DB save (module-level so it's shared across calls) ──────────────
const _debouncedSave = debounce(async (canvasId: string, get: () => DiagramState) => {
  if (!process.env.DATABASE_URL) return;
  const state = get();
  if (!state.userProfile || state.userProfile.id === 'guest') return;
  const canvas = state.canvases.find((c) => c.id === canvasId);
  if (!canvas) return;
  state.setSavingState('saving');
  try {
    await apiSaveUserCanvas({
      id: canvasId,
      name: canvas.name,
      nodes: canvas.nodes as object,
      edges: canvas.edges as object,
    });
    state.setSavingState('saved');
    // Reset to idle after 2s
    setTimeout(() => {
      if (get().savingState === 'saved') get().setSavingState('idle');
    }, 2000);
  } catch {
    state.setSavingState('idle');
  }
}, 1500);

// Delete canvas from DB
async function deleteCanvasFromDB(canvasId: string, get: () => DiagramState): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const state = get();
  if (!state.userProfile || state.userProfile.id === 'guest') return;
  try {
    await apiDeleteUserCanvas(canvasId);
  } catch {
    // Silently fail - canvas is already removed from local state
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

function wrapCreator(
  creator: StateCreator<DiagramState, [["zustand/persist", unknown]]>
): StateCreator<DiagramState, [["zustand/persist", unknown]]> {
  return (set, getRaw, api) => {
    const get = () => {
      return deriveNodesAndEdges(getRaw());
    };
    return creator(set, get, api);
  };
}

let isLayouting = false;

const useDiagramStoreRaw = create<DiagramState>()(
  persist(
    wrapCreator((set, get) => ({
      // ── Multi-canvas ───────────────────────────────────────────────────────
      canvases: [{ ...INITIAL_CANVAS, isOpen: true, lastAccessedAt: Date.now() }],
      activeCanvasId: INITIAL_CANVAS.id,
      openCanvasIds: [INITIAL_CANVAS.id],
      nodes: [],
      edges: [],
      sequenceDiagrams: {},
      pipelineStatus: 'idle',
      pipelineError: null,
      cloudProvider: 'off',
      diagramChromeMode: 'edit',
      diagramStyleTheme: 'default',

      getRandomAnimalName: () => {
        const animals = ['Elephant', 'Lion', 'Panda', 'Tiger', 'Falcon', 'Shark', 'Wolf', 'Fox', 'Bear', 'Eagle', 'Owl', 'Hawk', 'Dolphin', 'Penguin', 'Zebra', 'Giraffe', 'Leopard', 'Jaguar', 'Panther', 'Cheetah'];
        const usedNames = get().canvases.map(c => c.name);
        const available = animals.filter(a => !usedNames.includes(a));
        if (available.length > 0) {
          return available[Math.floor(Math.random() * available.length)];
        }
        const baseAnimal = animals[Math.floor(Math.random() * animals.length)];
        let counter = 1;
        while (usedNames.includes(`${baseAnimal} ${counter}`)) {
          counter++;
        }
        return `${baseAnimal} ${counter}`;
      },

      addCanvas: (customName?: string, canvasId?: string) => {
         const { canvases, openCanvasIds, getRandomAnimalName, userProfile } = get();
         const isGuest = !userProfile || userProfile.id === 'guest';
         if (isGuest) {
          const guestCanvases = canvases.filter((c) => c.id.startsWith('guest-canvas'));
          if (guestCanvases.length >= MAX_GUEST_CANVASES) {
            toast.error(`Guests can have up to ${MAX_GUEST_CANVASES} canvases. Delete one to create a new canvas.`);
            return get().activeCanvasId || 'guest-canvas';
          }

          const id = `guest-${crypto.randomUUID()}`;

          const name = customName || getRandomAnimalName();
          const newCanvas = {
            ...makeCanvas(name, id),
            isOpen: true,
            lastAccessedAt: Date.now(),
          };

          const nextCanvases = [...canvases, newCanvas];
          const nextOpenIds = openCanvasIds.includes(id) ? openCanvasIds : [...openCanvasIds, id];

          set({
            canvases: nextCanvases,
            openCanvasIds: nextOpenIds,
            activeCanvasId: id,
            past: [],
            future: [],
          });

          // Persist guest canvases immediately
          get().saveCanvasToDB(id);
          return id;
         }
         
         if (canvasId) {
           const existing = canvases.find(c => c.id === canvasId);
           if (existing) {
             get().switchCanvas(canvasId);
             return canvasId;
           }
         }

         const baseName = customName || getRandomAnimalName();
         let newName = baseName;
         const existingNames = new Set(canvases.map(c => c.name));
         
         let counter = 1;
         while (existingNames.has(newName)) {
           counter++;
           newName = `${baseName} ${counter}`;
         }
         
         const newCanvas = makeCanvas(newName, canvasId);
         const canvasWithMeta = { ...newCanvas, isOpen: true, lastAccessedAt: Date.now() };
         const newOpenIds = [...openCanvasIds, newCanvas.id];
         set({ 
           canvases: [...canvases, canvasWithMeta], 
           openCanvasIds: newOpenIds,
           activeCanvasId: newCanvas.id, 
           past: [], 
           future: [] 
         });
         return newCanvas.id;
       },

       duplicateCanvas: (id: string) => {
         const { canvases, openCanvasIds, userProfile } = get();
         const isGuest = !userProfile || userProfile.id === 'guest';
         if (isGuest) {
           toast.error("Sign in to duplicate canvases.");
           return;
         }
         const source = canvases.find(c => c.id === id);
         if (!source) return;
         
         const baseName = `${source.name} Copy`;
         let newName = baseName;
         const existingNames = new Set(canvases.map(c => c.name));
         
         let counter = 1;
         while (existingNames.has(newName)) {
           counter++;
           newName = `${baseName} ${counter}`;
         }
         
         const numbers = canvases
            .map(c => {
              const match = c.id.match(/^canvas-(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
          const max = numbers.length > 0 ? Math.max(...numbers) : 0;
          const newId = `canvas-${max + 1}`;
         const duplicated: CanvasTab = {
           ...source,
           id: newId,
           name: newName,
           isOpen: true,
           lastAccessedAt: Date.now(),
           nodes: JSON.parse(JSON.stringify(source.nodes)),
           edges: JSON.parse(JSON.stringify(source.edges)),
         };
         
         const newOpenIds = [...openCanvasIds, newId];
         set({
           canvases: [...canvases, duplicated],
           openCanvasIds: newOpenIds,
           activeCanvasId: newId,
           past: [],
           future: [],
         });
         return newId;
       },

      removeCanvas: (id) => {
        const { canvases, activeCanvasId, openCanvasIds, userProfile } = get();
        const isGuest = !userProfile || userProfile.id === 'guest';
        if (isGuest) {
          const guestCanvases = canvases.filter((c) => c.id.startsWith('guest-canvas'));
          if (guestCanvases.length <= 1) {
            // Keep at least one canvas in the UI; treat delete as "reset"
            const replacementId = guestCanvases[0]?.id || 'guest-canvas';
            const replacement: CanvasTab = {
              id: replacementId,
              name: get().getRandomAnimalName(),
              nodes: [],
              edges: [],
              updatedAt: Date.now(),
              createdAt: Date.now(),
              isOpen: true,
              lastAccessedAt: Date.now(),
            };
            set({
              canvases: [replacement],
              openCanvasIds: [replacementId],
              activeCanvasId: replacementId,
              past: [],
              future: [],
            });
            get().saveCanvasToDB(replacementId);
            return;
          }

          const idx = canvases.findIndex((c) => c.id === id);
          const next = canvases.filter((c) => c.id !== id);
          const newOpenIds = openCanvasIds.filter((cid) => cid !== id);

          let nextActiveId = activeCanvasId;
          if (activeCanvasId === id) {
            const newIdx = Math.max(0, idx - 1);
            nextActiveId = next[newIdx]?.id || next[0]?.id;
          }

          set({
            canvases: next,
            openCanvasIds: newOpenIds,
            activeCanvasId: nextActiveId,
            past: [],
            future: [],
          });
          get().saveCanvasToDB(nextActiveId);
          return;
        }
        if (canvases.length <= 1) return;
        
        const idx = canvases.findIndex((c) => c.id === id);
        const next = canvases.filter((c) => c.id !== id);
        const newOpenIds = openCanvasIds.filter((cid) => cid !== id);
        
        let nextActiveId = activeCanvasId;
        if (activeCanvasId === id) {
          const newIdx = Math.max(0, idx - 1);
          nextActiveId = next[newIdx]?.id || next[0]?.id;
        }
        set({ 
          canvases: next, 
          openCanvasIds: newOpenIds,
          activeCanvasId: nextActiveId, 
          past: [], 
          future: [] 
        });
        
        // Delete from DB
        deleteCanvasFromDB(id, get);
      },

      switchCanvas: async (id) => {
        const { canvases, activeCanvasId, openCanvasIds, userProfile } = get();
        const isGuest = !userProfile || userProfile.id === 'guest';
        if (isGuest && !id.startsWith('guest-canvas')) {
          return;
        }
        if (id === activeCanvasId) return;
        
        const target = canvases.find((c) => c.id === id);
        if (!target) return;

        // Fetch custom components if missing from registry
        await componentRegistry.ensureCustomComponentsForNodes(target.nodes);
        
        let newOpenIds = openCanvasIds;
        if (!openCanvasIds.includes(id)) {
          newOpenIds = [...openCanvasIds, id];
        }
        
        const updatedCanvases = canvases.map((c) => {
          if (c.id === id) {
            // Qualifies for lastAccessedAt because activeCanvasId changes
            return { ...c, lastAccessedAt: Date.now() };
          }
          return c;
        });
        
        set({ 
          canvases: updatedCanvases, 
          openCanvasIds: newOpenIds,
          activeCanvasId: id, 
          past: [], 
          future: [], 
          selectedNodeId: null, 
          selectedEdgeId: null 
        });
        setTimeout(() => get().fitView(), 80);
      },

      renameCanvas: (id, name) => {
        const canvases = get().canvases.map((c) => c.id === id ? { ...c, name, updatedAt: Date.now() } : c);
        set({ canvases });
        get().saveCanvasToDB(id);
      },

      openCanvas: async (id) => {
        const { canvases, activeCanvasId, openCanvasIds } = get();
        const isAlreadyOpen = openCanvasIds.includes(id);
        
        const target = canvases.find((c) => c.id === id);
        if (!target) return;

        // Fetch custom components if missing from registry
        await componentRegistry.ensureCustomComponentsForNodes(target.nodes);
        
        let newOpenIds: string[];
        if (isAlreadyOpen) {
          newOpenIds = openCanvasIds;
        } else {
          newOpenIds = [...openCanvasIds, id];
        }
        
        const updatedCanvases = canvases.map((c) => {
          if (c.id === id) {
            // Qualifies for lastAccessedAt because activeCanvasId changes
            return { ...c, isOpen: true, lastAccessedAt: Date.now() };
          }
          return c;
        });
        
        set({ 
          canvases: updatedCanvases, 
          openCanvasIds: newOpenIds,
          activeCanvasId: id,
          past: [],
          future: [],
          selectedNodeId: null,
          selectedEdgeId: null,
        });
        setTimeout(() => get().fitView(), 80);
      },

      closeCanvas: (id) => {
        const { canvases, activeCanvasId, openCanvasIds } = get();
        
        if (openCanvasIds.length <= 1) return;
        
        const idx = openCanvasIds.indexOf(id);
        const newOpenIds = openCanvasIds.filter((cid) => cid !== id);
        
        let nextActiveId = activeCanvasId;
        if (activeCanvasId === id) {
          const newIdx = Math.max(0, idx - 1);
          nextActiveId = newOpenIds[newIdx] || newOpenIds[0];
        }
        
        const updatedCanvases = canvases.map((c) => {
          if (c.id === id) {
            return { ...c, isOpen: false };
          }
          return c;
        });
        
        set({ 
          canvases: updatedCanvases,
          openCanvasIds: newOpenIds,
          activeCanvasId: nextActiveId,
          past: [],
          future: [],
        });
      },

      togglePinCanvas: (id) => {
        const canvases = get().canvases.map((c) => 
          c.id === id ? { ...c, isPinned: !c.isPinned } : c
        );
        set({ canvases });
      },

      toggleFavorite: (id) => {
        const canvases = get().canvases.map((c) => 
          c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
        );
        set({ canvases });
      },

      getOpenCanvases: () => {
        const { canvases, openCanvasIds } = get();
        return openCanvasIds
          .map((id) => canvases.find((c) => c.id === id))
          .filter((c): c is CanvasTab => c !== undefined);
      },

      getVisibleCanvases: () => {
        const { canvases, activeCanvasId, openCanvasIds } = get();
        const MAX_VISIBLE = 3;
        
        // Get open canvases in order of openCanvasIds
        const openCanvases = openCanvasIds
          .map((id) => canvases.find((c) => c.id === id))
          .filter((c): c is CanvasTab => c !== undefined);
        
        if (openCanvases.length <= MAX_VISIBLE) {
          return openCanvases;
        }
        
        // Separate active, pinned, and other canvases
        const activeCanvas = openCanvases.find((c) => c.id === activeCanvasId);
        const pinned = openCanvases.filter((c) => c.isPinned && c.id !== activeCanvasId);
        const other = openCanvases.filter((c) => !c.isPinned && c.id !== activeCanvasId);
        
        // Build visible list: active first, then pinned, then others
        const visible: CanvasTab[] = [];
        
        // 1. Always include active canvas first
        if (activeCanvas) {
          visible.push(activeCanvas);
        }
        
        // 2. Add pinned canvases (up to remaining slots)
        const remainingSlots = MAX_VISIBLE - visible.length;
        for (const c of pinned) {
          if (visible.length >= MAX_VISIBLE) break;
          visible.push(c);
        }
        
        // 3. Add other canvases by last accessed time
        const sortedOther = [...other].sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
        for (const c of sortedOther) {
          if (visible.length >= MAX_VISIBLE) break;
          visible.push(c);
        }
        
        return visible;
      },

      getOverflowCanvases: () => {
        const { canvases, activeCanvasId, openCanvasIds } = get();
        const MAX_VISIBLE = 3;
        
        // Get open canvases in order of openCanvasIds
        const openCanvases = openCanvasIds
          .map((id) => canvases.find((c) => c.id === id))
          .filter((c): c is CanvasTab => c !== undefined);
        
        if (openCanvases.length <= MAX_VISIBLE) {
          return [];
        }
        
        const visible = get().getVisibleCanvases();
        const visibleIds = new Set(visible.map((c) => c.id));
        
        // Return overflow: open canvases not in visible
        return openCanvases.filter((c) => !visibleIds.has(c.id));
      },

      getActiveCanvasId: () => {
        return get().activeCanvasId;
      },

      // ── User / Auth ────────────────────────────────────────────────────────
      userProfile: null,
      setUserProfile: (profile) => {
        const isGuest = !profile || profile.id === 'guest';
        if (isGuest) {
          let guestCanvas;
          const guestSaved = typeof window !== 'undefined' ? localStorage.getItem('archdraw-guest-canvas') : null;
          if (guestSaved) {
            try {
              guestCanvas = JSON.parse(guestSaved);
            } catch {
              guestCanvas = {
                id: 'guest-canvas',
                name: 'Elephant',
                nodes: [],
                edges: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isOpen: true,
                lastAccessedAt: Date.now(),
              };
            }
          } else {
            guestCanvas = {
              id: 'guest-canvas',
              name: 'Elephant',
              nodes: [],
              edges: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isOpen: true,
              lastAccessedAt: Date.now(),
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem('archdraw-guest-canvas', JSON.stringify(guestCanvas));
            }
          }
          const targetId = guestCanvas.id || 'guest-canvas';
          set({
            userProfile: profile,
            canvases: [guestCanvas],
            activeCanvasId: targetId,
            openCanvasIds: [targetId],
          });
        } else {
          set({ userProfile: profile });
        }
      },
      savingState: 'idle',
      setSavingState: (s) => set({ savingState: s }),

      loadCanvasesFromDB: async () => {
        if (!process.env.DATABASE_URL) return;
        const { activeCanvasId, canvases: localCanvases } = get();
        try {
          const { useAuthStore } = await import('@/store/authStore');
          const { user } = useAuthStore.getState();
          if (!user || user.id === 'guest') return;

          const rows = await apiGetUserCanvases();
          if (rows && rows.length > 0) {
            const dbCanvases: CanvasTab[] = rows.map((d: { id: string; name: string; nodes: unknown; edges: unknown; updatedAt: Date | null }) => {
              const rawNodes = normalizeNodes((d.nodes as unknown as Node[]) ?? []);
              const sortedNodes = validateAndFixNodes(rawNodes);
              return {
                id: d.id,
                name: d.name,
                nodes: sortedNodes,
                edges: normalizeEdges((d.edges as unknown as Edge[]) ?? []),
                updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
                isOpen: true,
                lastAccessedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
              };
            });

            // Merge local and DB canvases, keeping the most recent version of each
            const mergedCanvases = mergeCanvases(localCanvases, dbCanvases);
            
            const openIds = mergedCanvases.map((c) => c.id);
            const targetCanvas = mergedCanvases.find((c) => c.id === activeCanvasId) || mergedCanvases[0];
            set({
              canvases: mergedCanvases,
              openCanvasIds: openIds,
              activeCanvasId: targetCanvas.id,
            });
          }
        } catch {
          // silently fail — guest fallback
        }
      },

      saveCanvasToDB: (canvasId) => {
        const state = get();
        const isGuest = !state.userProfile || state.userProfile.id === 'guest';
        if (isGuest) {
          try {
            const guestCanvases = state.canvases
              .slice(0, MAX_GUEST_CANVASES);
            const serializedAll = JSON.stringify(guestCanvases);
            if (serializedAll.length > 2 * 1024 * 1024) {
              toast.warning('Your guest canvases are approaching the 2MB size limit. Please sign in to save without limits.');
            }
            localStorage.setItem(STORAGE_KEYS.guestCanvases, serializedAll);

            // Backwards compatibility / migration path: keep active canvas under legacy key
            const active = state.canvases.find((c) => c.id === canvasId) || guestCanvases[0];
            if (active) {
              localStorage.setItem('archdraw-guest-canvas', JSON.stringify(active));
            }
          } catch {
            // ignore
          }
          return;
        }
        _debouncedSave(canvasId, get);
      },

      // ── Selection ──────────────────────────────────────────────────────────
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
      setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),

      // ── UI state ───────────────────────────────────────────────────────────
      guideLines: [],
      edgeAnimations: true,
      showGrid: true,
      // `darkMode` is a read-only mirror of next-themes (the single source of
      // truth, keyed by localStorage['archdraw-theme'] and the `dark` class).
      // ThemeProvider's ThemeSync component writes this flag whenever
      // resolvedTheme changes. The value below is only a *seed* matching the
      // same key next-themes reads, so first paint stays consistent without a
      // flash; never write localStorage or toggle the `.dark` class from the
      // store — use toggleDarkMode(), which defers to next-themes via the
      // registered bridge.
      darkMode: (typeof window !== 'undefined' ? (window.localStorage.getItem('archdraw-theme') === 'dark') : false),
      sidebarOpen: false,
      canvasMode: 'empty',
      activeLayoutPresetId: 'layered-lr',
      detailLevel: 3,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setGuideLines: (lines) => set({ guideLines: lines }),
      setCanvasMode: (mode) => set({ canvasMode: mode }),
      setActiveLayoutPresetId: (id) => set({ activeLayoutPresetId: id }),
      setDetailLevel: (level) => set({ detailLevel: level }),
      isPenModeActive: false,
      setPenModeActive: (active) => set({ isPenModeActive: active }),
      applyLayoutPresetById: async (presetId) => {
        if (isLayouting) return;
        isLayouting = true;
        try {
          const preset = LAYOUT_PRESETS.find((p) => p.id === presetId) as LayoutPreset | undefined;
          if (!preset) return;

          get().pushHistory();

          if (preset.isFreeform) {
            set({ activeLayoutPresetId: presetId });
            return;
          }

          const { nodes, edges, activeCanvasId, canvases } = get();

          // Layered LR/TB use the same Mermaid → Dagre path as the toolbar toggler.
          // Other presets (e.g. force) keep the ELK canvas path.
          const isLayeredMermaid = presetId === 'layered-lr' || presetId === 'layered-tb';
          let layoutedNodes = nodes;
          let layoutedEdges = edges;

          if (isLayeredMermaid) {
            const result = await layoutDiagramViaMermaid(
              nodes,
              edges,
              directionFromPresetId(presetId)
            );
            if (!result.success) {
              console.error('[Layout] Mermaid layout failed:', result.warnings);
              return;
            }
            layoutedNodes = result.nodes;
            layoutedEdges = result.edges;
          } else {
            layoutedNodes = await applyLayoutPreset(nodes, edges, preset);
          }

          // Temporarily clear extent so React Flow does not clamp children
          // against the previous parent size while new group bounds settle.
          const nodesWithoutExtent = layoutedNodes.map((n) =>
            n.parentId || (n as { parentNode?: string }).parentNode
              ? { ...n, extent: undefined }
              : n
          );

          const nextCanvases = canvases.map((c) =>
            c.id === activeCanvasId
              ? {
                  ...c,
                  nodes: nodesWithoutExtent,
                  edges: layoutedEdges,
                  updatedAt: Date.now(),
                }
              : c
          );

          set({
            activeLayoutPresetId: presetId,
            canvases: nextCanvases,
          });

          get().saveCanvasToDB(activeCanvasId);
          setTimeout(() => get().fitView(), 100);

          setTimeout(() => {
            const { activeCanvasId: currentActiveId, canvases: currentCanvases } = get();
            const canvas = currentCanvases.find((c) => c.id === currentActiveId);
            if (!canvas) return;

            const restoredNodes = canvas.nodes.map((n) => {
              const pId = n.parentId || (n as { parentNode?: string }).parentNode;
              return pId
                ? { ...n, parentId: pId, parentNode: pId, extent: 'parent' as const }
                : n;
            });

            set({
              canvases: currentCanvases.map((c) =>
                c.id === currentActiveId ? { ...c, nodes: restoredNodes } : c
              ),
            });
          }, 250);
        } catch (e) {
          console.error('[Layout] Failed to apply layout preset:', e);
        } finally {
          isLayouting = false;
        }
      },
      toggleLayoutDirection: async () => {
        if (isLayouting) return;
        isLayouting = true;
        try {
          const { activeLayoutPresetId, nodes, edges, activeCanvasId, canvases } = get();
          const nextPresetId =
            activeLayoutPresetId === 'layered-tb' ? 'layered-lr' : 'layered-tb';

          get().pushHistory();

          const result = await layoutDiagramViaMermaid(
            nodes,
            edges,
            directionFromPresetId(nextPresetId)
          );
          if (!result.success) {
            console.error('[Layout] Mermaid toggle failed:', result.warnings);
            return;
          }

          const nodesWithoutExtent = result.nodes.map((n) =>
            n.parentId || (n as { parentNode?: string }).parentNode
              ? { ...n, extent: undefined }
              : n
          );

          const nextCanvases = canvases.map((c) =>
            c.id === activeCanvasId
              ? {
                  ...c,
                  nodes: nodesWithoutExtent,
                  edges: result.edges,
                  updatedAt: Date.now(),
                }
              : c
          );

          set({
            activeLayoutPresetId: nextPresetId,
            canvases: nextCanvases,
          });

          get().saveCanvasToDB(activeCanvasId);
          setTimeout(() => get().fitView(), 100);

          setTimeout(() => {
            const { activeCanvasId: currentActiveId, canvases: currentCanvases } = get();
            const canvas = currentCanvases.find((c) => c.id === currentActiveId);
            if (!canvas) return;

            const restoredNodes = canvas.nodes.map((n) => {
              const pId = n.parentId || (n as { parentNode?: string }).parentNode;
              return pId
                ? { ...n, parentId: pId, parentNode: pId, extent: 'parent' as const }
                : n;
            });

            set({
              canvases: currentCanvases.map((c) =>
                c.id === currentActiveId ? { ...c, nodes: restoredNodes } : c
              ),
            });
          }, 250);
        } finally {
          isLayouting = false;
        }
      },
      toggleGrid: () => set({ showGrid: !get().showGrid }),
      setCloudProvider: (toggle) => {
        const { activeCanvasId, canvases } = get();
        const nextCanvases = canvases.map((c) =>
          c.id === activeCanvasId ? { ...c, cloudProvider: toggle } : c
        );
        set({ canvases: nextCanvases });
        get().saveCanvasToDB(activeCanvasId);
      },
      setDiagramChromeMode: (mode) => set({ diagramChromeMode: mode }),
      setDiagramStyleTheme: (theme) => set({ diagramStyleTheme: theme }),
      toggleDarkMode: () => {
        const next = !get().darkMode;
        // Delegate to next-themes via the bridge rather than writing
        // localStorage / toggling the `.dark` class directly. ThemeSync then
        // mirrors the resulting resolvedTheme back into store.darkMode, so the
        // store flag stays a read-only view of the real theme state.
        applyThemeChange(next);
      },
      toggleEdgeAnimations: () => {
        const next = !get().edgeAnimations;
        const edges = get().edges.map((e) => ({ ...e, animated: next }));
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edges updated
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ edgeAnimations: next, canvases });
      },

      // ── History ────────────────────────────────────────────────────────────
      past: [],
      future: [],
      pushHistory: () => {
        const { nodes, edges, past } = get();
        set({ past: [...past.slice(-30), { nodes, edges }], future: [] });
      },
      undo: () => {
        const { past, nodes, edges, future, activeCanvasId, canvases } = get();
        if (!past.length) return;
        const prev = past[past.length - 1];
        const newCanvases = canvases.map((c) =>
          // Qualifies for updatedAt because nodes/edges updated due to undo
          c.id === activeCanvasId ? { ...c, nodes: prev.nodes, edges: prev.edges, updatedAt: Date.now() } : c
        );
        set({ past: past.slice(0, -1), future: [{ nodes, edges }, ...future], canvases: newCanvases });
      },
      redo: () => {
        const { future, nodes, edges, past, activeCanvasId, canvases } = get();
        if (!future.length) return;
        const next = future[0];
        const newCanvases = canvases.map((c) =>
          // Qualifies for updatedAt because nodes/edges updated due to redo
          c.id === activeCanvasId ? { ...c, nodes: next.nodes, edges: next.edges, updatedAt: Date.now() } : c
        );
        set({ future: future.slice(1), past: [...past, { nodes, edges }], canvases: newCanvases });
      },

      // ── Node/edge operations ───────────────────────────────────────────────
      onNodesChange: (changes) => {
        // Structural changes = add/remove (infrequent). These justify history + save.
        // Position/dimension/selection changes are high-frequency (60fps during drag).
        // Writing `updatedAt: Date.now()` on EVERY change creates a new object on every
        // tick, which always passes Zustand's shallow-equal check and causes an
        // infinite render loop: change → set → re-render → onNodesChange → ∞
        const structural = changes.filter((c) => c.type === 'add' || c.type === 'remove');
        const isStructural = structural.length > 0;

        if (isStructural) get().pushHistory();

        let nodes = applyNodeChanges(changes, get().nodes);
        if (isStructural) {
          nodes = validateAndFixNodes(nodes);
        }

        const activeId = get().activeCanvasId;
        const canvases = get().canvases.map((c) =>
          c.id === activeId
            ? { ...c, nodes, ...(isStructural ? { updatedAt: Date.now() } : {}) }
            : c
        );
        set({ canvases });

        // Only persist on structural changes — debounce is too slow to stop the loop
        // on position updates; the drag-stop handler will trigger a save instead.
        if (isStructural) {
          get().saveCanvasToDB(activeId);
        }
      },

      onEdgesChange: (changes) => {
        // Only 'remove' is structural for edges.
        const structural = changes.filter((c) => c.type === 'remove');
        const isStructural = structural.length > 0;

        if (isStructural) get().pushHistory();

        const edges = applyEdgeChanges(changes, get().edges);
        const activeId = get().activeCanvasId;
        const canvases = get().canvases.map((c) =>
          c.id === activeId
            ? { ...c, edges, ...(isStructural ? { updatedAt: Date.now() } : {}) }
            : c
        );
        set({ canvases });

        if (isStructural) {
          get().saveCanvasToDB(activeId);
        }
      },

      onConnect: (connection) => {
        get().pushHistory();
        const { source, target, sourceHandle, targetHandle } = connection;
        if (!source || !target) return;

        const newEdge = createEdge(source, target, 'Connection', {
            sourceHandle,
            targetHandle,
        });

        const rawEdges = addEdge(
          newEdge,
          get().edges
        );
        const edges = distributeTargetHandles(get().nodes, rawEdges);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edge was added/connected
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );

        const connectedEdge = edges.find(e => 
          (e.source === source && e.target === target) || 
          (e.source === target && e.target === source)
        );
        // If the new connection was absorbed into a merged parallel edge, skip
        // the label editor so its empty draft can't wipe the combined label.
        const mergedAway = !!connectedEdge && connectedEdge.id !== newEdge.id;
        const finalPendingId = mergedAway ? null : (connectedEdge ? connectedEdge.id : newEdge.id);

        set({ canvases, pendingLabelEdgeId: finalPendingId });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      onReconnect: (oldEdge, newConnection) => {
        get().pushHistory();
        const rawEdges = get().edges.map(e => {
          if (e.id === oldEdge.id) {
            return {
              ...e,
              source: newConnection.source || e.source,
              target: newConnection.target || e.target,
              sourceHandle: newConnection.sourceHandle || e.sourceHandle,
              targetHandle: newConnection.targetHandle || e.targetHandle,
            };
          }
          return e;
        });
        const edges = distributeTargetHandles(get().nodes, rawEdges);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edges reconnected
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      addNodeOnEdgeDrop: ({ originNodeId, originHandleType, position }) => {
        const state = get();
        const isGuest = !state.userProfile || state.userProfile.id === 'guest';
        const nodeLimit = isGuest ? MAX_GUEST_NODES : MAX_AUTH_NODES;
        if (state.nodes.length >= nodeLimit) {
          toast.error(isGuest
            ? `Guest limit: ${nodeLimit} nodes per canvas. Sign in for ${MAX_AUTH_NODES}.`
            : `Canvas limit: ${nodeLimit} nodes.`);
          return '';
        }

        get().pushHistory();

        const newNode = {
          ...createNode(
            'service',
            '',
            position,
            {
              type: 'systemNode',
              data: {
                category: 'Compute',
                color: '#6366f1',
                icon: 'Box',
                shape: getNodeShape('Compute'),
                label: '',
                autoStartLabelEdit: true,
              },
            }
          ),
          selected: true,
        };

        let source: string;
        let target: string;
        if (originHandleType === 'target') {
          source = newNode.id;
          target = originNodeId;
        } else {
          source = originNodeId;
          target = newNode.id;
        }

        const newEdge = createEdge(source, target, '', {
          sourceHandle: undefined,
          targetHandle: undefined,
        });

        const nodes = [...get().nodes.map((n) => ({ ...n, selected: false })), newNode];
        const rawEdges = addEdge(newEdge, get().edges);
        const edges = distributeTargetHandles(nodes, rawEdges);
        const canvases = get().canvases.map((c) =>
          c.id === get().activeCanvasId ? { ...c, nodes, edges, updatedAt: Date.now() } : c
        );
        set({
          canvases,
          selectedNodeId: newNode.id,
          selectedNodeIds: [newNode.id],
        });
        get().saveCanvasToDB(get().activeCanvasId);
        return newNode.id;
      },

      addNode: (type, label, category, color, icon, technology, position) => {
        const state = get();
        const isGuest = !state.userProfile || state.userProfile.id === 'guest';
        const nodeLimit = isGuest ? MAX_GUEST_NODES : MAX_AUTH_NODES;
        if (state.nodes.length >= nodeLimit) {
          toast.error(isGuest
            ? `Guest limit: ${nodeLimit} nodes per canvas. Sign in for ${MAX_AUTH_NODES}.`
            : `Canvas limit: ${nodeLimit} nodes.`);
          return;
        }

        get().pushHistory();
        
        let newNode: Node<NodeData>;
        
        // Check if first arg is a pre-built node (from factory)
        if (typeof type === 'object' && 'id' in type && 'data' in type) {
          newNode = type as Node<NodeData>;
        } else {
          // Legacy path - construct node through factory
          const pos = position ?? { x: 400 + Math.random() * 200 - 100, y: 300 + Math.random() * 200 - 100 };
          const shape = getNodeShape(category || 'Compute');
          
          let componentType = type;
          try {
            getStrictPortConfig(type);
          } catch {
            componentType = (category || 'compute').toLowerCase().replace(/[^a-z0-9]/g, '_');
          }
          
          newNode = createNode(
            type,
            label || type,
            pos,
            {
              type: 'systemNode',
              data: {
                category: category || 'Compute',
                color,
                icon,
                technology,
                shape,
                componentType,
              }
            }
          ) as Node<NodeData>;
        }
        
        const nodes = [...get().nodes, newNode];
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because node was added
          c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      removeNode: (id) => {
        get().pushHistory();
        const nodes = get().nodes;
        const targetNode = nodes.find((n) => n.id === id);
        
        let updatedNodes = nodes.filter((n) => n.id !== id);
        
        // If deleting a group node, ungroup its children first
        if (targetNode?.type === 'groupNode' || targetNode?.type === 'group') {
          const groupPosition = targetNode.position;
          updatedNodes = updatedNodes.map((n) => {
            if (n.parentId === id || (n as Record<string, unknown>).parentNode === id) {
              return {
                ...n,
                position: {
                  x: n.position.x + groupPosition.x,
                  y: n.position.y + groupPosition.y,
                },
                parentId: undefined,
                parentNode: undefined,
                extent: undefined,
              };
            }
            return n;
          });
        }
        
        // Clean orphaned children and validate node order
        const validatedNodes = validateAndFixNodes(updatedNodes);
        
        const edges = get().edges.filter((e) => e.source !== id && e.target !== id);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because node was removed
          c.id === get().activeCanvasId ? { ...c, nodes: validatedNodes, edges, updatedAt: Date.now() } : c
        );
        set({ canvases, selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      updateNodeData: (id, data) => {
        const nodes = get().nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because node data changed
          c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      updateNodeSize: (id, size) => {
        const nodes = get().nodes.map((n) => {
          if (n.id !== id) return n;
          // Groups render their size via `style.width/height`, so update both the
          // top-level dimensions and the style so resizing is reflected on screen.
          const style = { ...(n.style || {}) };
          if (size.width !== undefined) style.width = size.width;
          if (size.height !== undefined) style.height = size.height;
          return {
            ...n,
            style,
            ...(size.width !== undefined && { width: size.width }),
            ...(size.height !== undefined && { height: size.height }),
          };
        });
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because node size changed
          c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      updateEdgeData: (id, data) => {
        const edges = get().edges.map((e) =>
          e.id === id
            ? {
                ...e,
                label: data.label !== undefined ? (data.label as string) : e.label,
                data: { ...e.data, ...data },
              }
            : e
        );
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edge data changed
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      deleteEdge: (edgeId) => {
        get().pushHistory();
        const edges = get().edges.filter((e) => e.id !== edgeId);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edge was deleted
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ canvases, selectedEdgeId: null });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      importDiagram: (nodes, edges) => {
        get().pushHistory();
        
        const normalizedNodes = normalizeNodes(nodes);
        const cleanedNodes = stripReservedLayerNodes(normalizedNodes);
        const validatedNodes = validateAndFixNodes(cleanedNodes);
        const normalizedEdges = normalizeEdges(edges);
        
        const { nodes: clarityNodes, edges: clarityEdges, report } = runClarityCompiler(validatedNodes, normalizedEdges);
        
        if (report.warnings.length > 0) {
          console.log('[ClarityCompiler]', report.warnings.join('; '));
        }
        
        const edgesWithHandles = distributeTargetHandles(clarityNodes, clarityEdges);
        
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because diagram was imported
          c.id === get().activeCanvasId ? { ...c, nodes: clarityNodes, edges: edgesWithHandles, updatedAt: Date.now() } : c
        );
        set({ canvases, clarityReport: report });
        get().saveCanvasToDB(get().activeCanvasId);
        setTimeout(() => get().fitView(), 80);
      },

      clearDiagram: () => {
        get().pushHistory();
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because canvas was cleared
          c.id === get().activeCanvasId ? { ...c, nodes: [], edges: [], updatedAt: Date.now() } : c
        );
        set({ canvases, selectedNodeId: null });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      deleteSelected: () => {
        const { selectedNodeId, selectedNodeIds, selectedEdgeId, deleteEdge, pushHistory, nodes: currentNodes, edges: currentEdges, canvases: currentCanvases, activeCanvasId } = get();
        
        if (selectedEdgeId) {
          pushHistory();
          deleteEdge(selectedEdgeId);
          return;
        }
        
        const idsToDelete = selectedNodeIds.length > 0 ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []);
        
        if (idsToDelete.length === 0) return;
        
        pushHistory();
        
        const groupIdsToDelete = idsToDelete.filter((id) => {
          const node = currentNodes.find((n) => n.id === id);
          return node?.type === 'groupNode';
        });
        
        const childIdsOfGroups = new Set(
          groupIdsToDelete.flatMap((gid) =>
            currentNodes.filter((n) => n.parentId === gid || (n as Record<string, unknown>).parentNode === gid).map((n) => n.id)
          )
        );
        
        const allIdsToDelete = new Set([...idsToDelete, ...Array.from(childIdsOfGroups)]);
        
        let finalNodes = currentNodes.filter((n) => !allIdsToDelete.has(n.id));
        finalNodes = validateAndFixNodes(finalNodes);
        
        const newEdges = currentEdges.filter((e) => {
          if (allIdsToDelete.has(e.source) || allIdsToDelete.has(e.target)) return false;
          return true;
        });
        
        const syncedCanvases = currentCanvases.map((c) =>
          // Qualifies for updatedAt because selected items were deleted
          c.id === activeCanvasId ? { ...c, nodes: finalNodes, edges: newEdges, updatedAt: Date.now() } : c
        );
        
        set({ canvases: syncedCanvases, selectedNodeIds: [], selectedNodeId: null });
        get().saveCanvasToDB(activeCanvasId);
      },

      selectAll: () => {
        const { canvases, activeCanvasId } = get();
        const active = canvases.find((c) => c.id === activeCanvasId);
        if (!active) return;
        set({
          canvases: canvases.map((c) =>
            c.id === activeCanvasId
              ? {
                  ...c,
                  nodes: c.nodes.map((n) => ({ ...n, selected: true })),
                  edges: c.edges.map((e) => ({ ...e, selected: true })),
                }
              : c
          ),
          selectedNodeId: null,
          selectedNodeIds: active.nodes.map((n) => n.id),
          selectedEdgeId: null,
        });
      },

      createGroup: (parentId?: string) => {
        const { nodes, selectedNodeIds, selectedNodeId, pushHistory, activeCanvasId, canvases } = get();
        const idsToGroup =
          selectedNodeIds.length > 0
            ? selectedNodeIds
            : selectedNodeId
              ? [selectedNodeId]
              : [];
        if (idsToGroup.length < 1) return;
        pushHistory();
        
        const selected = nodes.filter((n) => idsToGroup.includes(n.id));
        const isNested = !!parentId;
        
        // Smaller padding for nested groups
        const PAD_SIDE = isNested ? 30 : 60;
        const PAD_TOP  = isNested ? 40 : 72;
        const PAD_BOT  = isNested ? 30 : 60;
        
        // Calculate bounds from selected nodes
        const rawMinX = Math.min(...selected.map((n) => n.position.x));
        const rawMinY = Math.min(...selected.map((n) => n.position.y));
        const rawMaxX = Math.max(...selected.map((n) => n.position.x + (n.width ?? 160)));
        const rawMaxY = Math.max(...selected.map((n) => n.position.y + (n.height ?? 80)));
        
        // For nested groups, convert to parent-relative coordinates
        let positionOffset = { x: 0, y: 0 };
        if (parentId) {
          const parent = nodes.find((n) => n.id === parentId);
          if (parent) {
            positionOffset = { x: parent.position.x, y: parent.position.y };
          }
        }
        
        const minX = rawMinX - PAD_SIDE;
        const minY = rawMinY - PAD_TOP;
        const maxX = rawMaxX + PAD_SIDE;
        const maxY = rawMaxY + PAD_BOT;
        
        const existingGroupCount = nodes.filter((n) => n.type === 'groupNode' || n.data?.isGroup).length;
        const colors = ['#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
        const groupColor = colors[existingGroupCount % colors.length];

        const groupId = `group-${Date.now()}`;
        const groupNode: Node = {
          id: groupId, 
          type: 'groupNode',
          position: { 
            x: isNested ? rawMinX - positionOffset.x - PAD_SIDE : minX, 
            y: isNested ? rawMinY - positionOffset.y - PAD_TOP : minY 
          },
          style: { width: maxX - minX, height: maxY - minY },
          width: maxX - minX,
          height: maxY - minY,
          data: { label: 'Group', groupLabel: 'Group', groupColor }, 
          zIndex: -1,
          draggable: true,
          selectable: true,
          ...(parentId ? { parentId, parentNode: parentId, extent: 'parent' as const } : {}),
        };
        
        const newNodes = [
          ...nodes.filter((n) => !idsToGroup.includes(n.id)),
          groupNode,
          ...selected.map((n) => ({
            ...n,
            parentId: groupId,
            parentNode: groupId,
            extent: 'parent' as const,
            position: { 
              x: isNested ? n.position.x - positionOffset.x - (rawMinX - positionOffset.x - PAD_SIDE) : n.position.x - minX,
              y: isNested ? n.position.y - positionOffset.y - (rawMinY - positionOffset.y - PAD_TOP) : n.position.y - minY
            },
          }))
        ];
        
        const newCanvases = canvases.map((c) =>
          // Qualifies for updatedAt because group was created
          c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
        );
        set({ canvases: newCanvases, selectedNodeIds: [], selectedNodeId: groupId });
        get().saveCanvasToDB(activeCanvasId);
      },

      ungroupNodes: (groupId: string) => {
        const { nodes, pushHistory, activeCanvasId, canvases, edges } = get();
        const group = nodes.find((n) => n.id === groupId);
        if (!group || group.type !== 'groupNode') return;
        pushHistory();
        
        const children = nodes.filter((n) => n.parentId === groupId || (n as Record<string, unknown>).parentNode === groupId);
        const parentOffset = { x: group.position.x, y: group.position.y };
        
        // Check if this group has a parent (nested group)
        const grandParentId = group.parentId || (group as Record<string, unknown>).parentNode as string | undefined;
        
        let newNodes = nodes
          .filter((n) => n.id !== groupId)
          .map((n) => {
            if (n.parentId === groupId || (n as Record<string, unknown>).parentNode === groupId) {
              // If there's a grandparent, keep children in the grandparent's context
              if (grandParentId) {
                return {
                  ...n,
                  parentId: grandParentId,
                  parentNode: grandParentId,
                  extent: 'parent' as const,
                  position: { x: n.position.x + parentOffset.x, y: n.position.y + parentOffset.y },
                };
              }
              // Otherwise, remove from all groups
              return {
                ...n,
                parentId: undefined,
                parentNode: undefined,
                extent: undefined,
                position: { x: n.position.x + parentOffset.x, y: n.position.y + parentOffset.y },
              };
            }
            return n;
          });
        newNodes = validateAndFixNodes(newNodes);
        
        const newCanvases = canvases.map((c) =>
          // Qualifies for updatedAt because nodes were ungrouped
          c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
        );
        set({ canvases: newCanvases, selectedNodeIds: children.map((c) => c.id) });
        get().saveCanvasToDB(activeCanvasId);
      },

      moveToGroup: (nodeId: string, groupId: string | null) => {
        const { nodes, pushHistory, activeCanvasId, canvases } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        pushHistory();
        
        const parentId = node.parentId || (node as { parentNode?: string }).parentNode;
        let newPosition = { ...node.position };
        if (groupId) {
          const group = nodes.find((n) => n.id === groupId);
          if (group) {
            newPosition = { x: node.position.x - group.position.x, y: node.position.y - group.position.y };
          }
        } else if (parentId) {
          const parent = nodes.find((n) => n.id === parentId);
          if (parent) {
            newPosition = { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y };
          }
        }
        
        const newNodes = nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                parentId: groupId ?? undefined,
                parentNode: groupId ?? undefined,
                extent: groupId ? 'parent' as const : undefined,
                position: newPosition,
              }
            : n
        );
        
        const newCanvases = canvases.map((c) =>
          // Qualifies for updatedAt because node moved to group
          c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
        );
        set({ canvases: newCanvases });
        get().saveCanvasToDB(activeCanvasId);
      },

      loadTemplate: (nodes, edges) => {
        // Same import path as the layout toggler (`importDiagram`) so
        // Mermaid-pre-laid templates keep compound positions/handles instead of
        // being scrambled by resolveNodeCollisions.
        get().importDiagram(nodes, edges);
        set({ selectedNodeId: null, selectedEdgeId: null });
      },

      // ── Fit view ───────────────────────────────────────────────────────────
      fitView: (opts) => {
        fitViewCallback?.(opts ?? { padding: 0.0, duration: 400 });
      },

      // ── Edge editing ───────────────────────────────────────────────────────
      editingEdgeId: null,
      setEditingEdgeId: (id) => set({ editingEdgeId: id }),
      pendingEditEdgeId: null,
      setPendingEditEdgeId: (id) => set({ pendingEditEdgeId: id }),
      pendingLabelEdgeId: null,
      setPendingLabelEdgeId: (id) => set({ pendingLabelEdgeId: id }),
      
      updateEdgeLabel: (edgeId, label) => {
        const edges = get().edges.map((e) =>
          e.id === edgeId ? { ...e, label: label.trim(), data: { ...e.data, label: label.trim() } } : e
        );
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edge label changed
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      // ── AI Streaming ──────────────────────────────────────────────────────
      setNodes: (nodes) => {
        const validatedNodes = validateAndFixNodes(normalizeNodes(nodes));
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because nodes set/updated by builder
          c.id === get().activeCanvasId ? { ...c, nodes: validatedNodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },
      setEdges: (edges) => {
        const normalized = normalizeEdges(edges);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edges set/updated by builder
          c.id === get().activeCanvasId ? { ...c, edges: normalized, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },
      appendNode: (node) => {
        const nodes = [...get().nodes, { ...node, type: normalizeNodeType(node.type as string | undefined) }];
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because node size changed
          c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },
      appendEdge: (edge) => {
        const edges = [...get().edges, normalizeEdge(edge)];
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because edge label changed
          c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      startGeneration: () => {
        const activeId = get().activeCanvasId;
        set((state) => ({
          pipelineStatus: 'generating',
          pipelineError: null,
          canvases: state.canvases.map((c) =>
            c.id === activeId ? { ...c, nodes: [], edges: [], updatedAt: Date.now() } : c
          ),
        }));
      },
      markPipelineDone: () => set({ pipelineStatus: 'done' }),
      markPipelineError: (message: string) =>
        set({ pipelineStatus: 'error', pipelineError: message }),
      clearPipelineStatus: () => set({ pipelineStatus: 'idle', pipelineError: null }),

      setSequenceDiagram: (canvasId: string, mermaidSyntax: string, title: string) => {
        set((state) => ({
          sequenceDiagrams: {
            ...state.sequenceDiagrams,
            [canvasId]: { mermaidSyntax, title },
          },
        }));
      },
      clearSequenceDiagram: (canvasId: string) => {
        set((state) => {
          const { [canvasId]: _, ...rest } = state.sequenceDiagrams;
          return { sequenceDiagrams: rest };
        });
      },
      importSequenceDiagram: (mermaidSyntax: string, title: string) => {
        const canvasId = get().activeCanvasId;
        set((state) => ({
          sequenceDiagrams: {
            ...state.sequenceDiagrams,
            [canvasId]: { mermaidSyntax, title },
          },
          canvases: state.canvases.map((c) =>
            // Qualifies for updatedAt because nodes/edges cleared for sequence diagram
            c.id === canvasId ? { ...c, nodes: [], edges: [], updatedAt: Date.now() } : c
          )
        }));
        get().saveCanvasToDB(canvasId);
      },

      loadDefaultArchitecture: () => {
        const defaultNodes: Node[] = [
          createNode('client-1', 'Web Client', { x: 50, y: 100 }, { type: 'systemNode', data: { icon: '🌐', category: 'Client' } }),
          createNode('client-2', 'Mobile App', { x: 50, y: 250 }, { type: 'systemNode', data: { icon: '📱', category: 'Client' } }),
          createNode('gateway', 'API Gateway', { x: 300, y: 175 }, { type: 'systemNode', data: { icon: '🚪', category: 'Compute' } }),
          createNode('auth', 'Auth Service', { x: 550, y: 50 }, { type: 'systemNode', data: { icon: '🔐', category: 'Compute' } }),
          createNode('core', 'Core API', { x: 550, y: 175 }, { type: 'systemNode', data: { icon: '⚙️', category: 'Compute' } }),
          createNode('billing', 'Billing Service', { x: 550, y: 300 }, { type: 'systemNode', data: { icon: '💳', category: 'Compute' } }),
          createNode('queue', 'Task Queue', { x: 800, y: 175 }, { type: 'systemNode', data: { icon: '📋', category: 'Message' } }),
          createNode('email', 'Email Service', { x: 1050, y: 100 }, { type: 'systemNode', data: { icon: '📧', category: 'Compute' } }),
          createNode('notif', 'Notification Svc', { x: 1050, y: 250 }, { type: 'systemNode', data: { icon: '🔔', category: 'Compute' } }),
          createNode('db', 'PostgreSQL', { x: 1300, y: 175 }, { type: 'systemNode', data: { icon: '🐘', category: 'Database' } }),
          createNode('cache', 'Redis Cache', { x: 1300, y: 300 }, { type: 'systemNode', data: { icon: '⚡', category: 'Cache' } }),
        ] as Node[];

        const defaultEdges: Edge[] = [
          createEdge('client-1', 'gateway', 'HTTPS'),
          createEdge('client-2', 'gateway', 'HTTPS'),
          createEdge('gateway', 'auth', 'auth'),
          createEdge('gateway', 'core', 'API'),
          createEdge('gateway', 'billing', 'API'),
          createEdge('core', 'queue', 'enqueue', { data: { edgeType: 'async' } }),
          createEdge('billing', 'queue', 'enqueue', { data: { edgeType: 'async' } }),
          createEdge('queue', 'email', 'process', { data: { edgeType: 'async' } }),
          createEdge('queue', 'notif', 'notify', { data: { edgeType: 'async' } }),
          createEdge('core', 'db', 'read/write'),
          createEdge('core', 'cache', 'cache'),
          createEdge('billing', 'db', 'read/write'),
        ];

        get().pushHistory();
        const normalizedNodes = normalizeNodes(defaultNodes);
        const normalizedEdges = normalizeEdges(defaultEdges);
        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because default architecture loaded
          c.id === get().activeCanvasId ? { ...c, nodes: normalizedNodes, edges: normalizedEdges, updatedAt: Date.now() } : c
        );
        set({ canvases, selectedNodeId: null, selectedEdgeId: null });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      alignConnectedNodes: () => {
        const { nodes, edges, selectedNodeIds } = get();
        const sel = new Set(selectedNodeIds);
        if (sel.size < 2) return;

        const relevantEdges = edges.filter(e => sel.has(e.source) && sel.has(e.target));
        if (relevantEdges.length === 0) return;

        get().pushHistory();

        const updated = nodes.map(n => ({
          ...n,
          position: { ...n.position },
          data: { ...n.data } as NodeData,
        }));

        for (const edge of relevantEdges) {
          const source = updated.find(n => n.id === edge.source);
          const target = updated.find(n => n.id === edge.target);
          if (!source || !target) continue;

          const dx = target.position.x - source.position.x;
          const dy = target.position.y - source.position.y;

          const sw = source.width ?? (source.data as NodeData)?.nodeWidth ?? 180;
          const sh = source.height ?? 70;
          const tw = target.width ?? (target.data as NodeData)?.nodeWidth ?? 180;
          const th = target.height ?? 70;

          if (Math.abs(dx) > Math.abs(dy)) {
            const srcCenterY = source.position.y + sh / 2;
            target.position.y = srcCenterY - th / 2;
          } else {
            const srcCenterX = source.position.x + sw / 2;
            target.position.x = srcCenterX - tw / 2;
          }
        }

        const canvases = get().canvases.map((c) =>
          // Qualifies for updatedAt because connected nodes aligned
          c.id === get().activeCanvasId ? { ...c, nodes: updated, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
      },

      recalculateHandles: () => {
        const { nodes, edges, activeCanvasId, canvases } = get();
        const edgesWithHandles = distributeTargetHandles(nodes, edges);
        const nextCanvases = canvases.map((c) =>
          c.id === activeCanvasId ? { ...c, edges: edgesWithHandles, updatedAt: Date.now() } : c
        );
        set({ canvases: nextCanvases });
        get().saveCanvasToDB(activeCanvasId);
      },
    })),
    {
    name: 'archdraw-storage',
      storage: createJSONStorage(() => serializedStorage),
      partialize: (s) => ({
        canvases: s.canvases,
        activeCanvasId: s.activeCanvasId,
        edgeAnimations: s.edgeAnimations,
        showGrid: s.showGrid,
        diagramChromeMode: s.diagramChromeMode,
        diagramStyleTheme: s.diagramStyleTheme,
        userProfile: s.userProfile,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Problem 2: Load guest canvas if user is guest or not logged in
          // Only use guest storage as fallback when rehydrated canvases are empty
          // (avoid overriding proper rehydration from archdraw-storage main persist key)
          const isGuest = !state.userProfile || state.userProfile.id === 'guest';
          const isNewSession = typeof window !== 'undefined' && !sessionStorage.getItem('archdraw-session-active');

          if (isGuest && isNewSession) {
            // New browser session for guest user -> clear all guest progress and start fresh!
            try {
              localStorage.removeItem(STORAGE_KEYS.guestCanvases);
              localStorage.removeItem('archdraw-guest-canvas');
            } catch {
              // ignore
            }

            const defaultGuest: CanvasTab = {
              id: 'guest-canvas',
              name: 'Elephant',
              nodes: [],
              edges: [],
              updatedAt: Date.now(),
              createdAt: Date.now(),
              isOpen: true,
              lastAccessedAt: Date.now(),
            };

            state.canvases = [defaultGuest];
            state.activeCanvasId = 'guest-canvas';
            state.openCanvasIds = ['guest-canvas'];

            try {
              sessionStorage.setItem('archdraw-session-active', 'true');
            } catch {
              // ignore
            }
          } else if (isGuest) {
            // Existing session refresh / reload -> load normally from localStorage or fallback
            if (!state.canvases || state.canvases.length === 0) {
              const guestListSaved = localStorage.getItem(STORAGE_KEYS.guestCanvases);
              if (guestListSaved) {
                try {
                  const list = JSON.parse(guestListSaved);
                  if (Array.isArray(list) && list.length > 0) {
                    const guestCanvases = list
                      .filter((c: { id?: string }) => c && typeof c.id === 'string')
                      .slice(0, MAX_GUEST_CANVASES)
                      .map((c: { id: string; nodes?: unknown[]; edges?: unknown[]; lastAccessedAt?: number; updatedAt?: number; createdAt?: number }) => ({
                        ...c,
                        isOpen: true,
                        lastAccessedAt: c.lastAccessedAt || c.updatedAt || Date.now(),
                        createdAt: c.createdAt || Date.now(),
                        updatedAt: c.updatedAt || Date.now(),
                        nodes: c.nodes || [],
                        edges: c.edges || [],
                      }));

                    state.canvases = guestCanvases as CanvasTab[];
                    state.openCanvasIds = guestCanvases.map((c) => c.id);
                    state.activeCanvasId =
                      state.activeCanvasId && guestCanvases.some((c) => c.id === state.activeCanvasId)
                        ? state.activeCanvasId
                        : guestCanvases[0].id;

                    // keep legacy key pointing at active
                    const active = guestCanvases.find((c) => c.id === state.activeCanvasId) || guestCanvases[0];
                    localStorage.setItem('archdraw-guest-canvas', JSON.stringify(active));
                  }
                } catch {
                  // ignore
                }
              }

              // Backwards compat fallback: single guest canvas
              if (!state.canvases || state.canvases.length === 0) {
                const guestSaved = localStorage.getItem('archdraw-guest-canvas');
                if (guestSaved) {
                  try {
                    const canvas = JSON.parse(guestSaved);
                    state.canvases = [{ ...canvas, isOpen: true, lastAccessedAt: Date.now() }];
                    state.activeCanvasId = canvas.id || 'guest-canvas';
                    state.openCanvasIds = [state.activeCanvasId];
                  } catch {
                    // ignore
                  }
                }
              }

              if (!state.canvases || state.canvases.length === 0) {
                const defaultGuest: CanvasTab = {
                  id: 'guest-canvas',
                  name: 'Elephant',
                  nodes: [],
                  edges: [],
                  updatedAt: Date.now(),
                  createdAt: Date.now(),
                  isOpen: true,
                  lastAccessedAt: Date.now(),
                };
                state.canvases = [defaultGuest];
                state.activeCanvasId = 'guest-canvas';
                state.openCanvasIds = ['guest-canvas'];
                localStorage.setItem(STORAGE_KEYS.guestCanvases, JSON.stringify([defaultGuest]));
                localStorage.setItem('archdraw-guest-canvas', JSON.stringify(defaultGuest));
              }
            }

            // Always set session active flag on reload so next reload knows it is in the same session
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('archdraw-session-active', 'true');
              } catch {
                // ignore
              }
            }
          }

          if (state.canvases && state.canvases.length > 0) {
            // Ensure activeCanvasId is valid
            if (!state.activeCanvasId || !state.canvases.find((c: CanvasTab) => c.id === state.activeCanvasId)) {
              state.activeCanvasId = state.canvases[0].id;
            }
            
            // Clean up and normalize node and edge types in all canvases
            state.canvases = state.canvases.map((c: CanvasTab) => {
              const normalizedNodes = normalizeNodes(c.nodes || []);
              const cleaned = stripReservedLayerNodes(normalizedNodes);
              const validated = validateAndFixNodes(cleaned);
              const resolved = resolveNodeCollisions(sanitizeNodes(validated));
              const normalizedEdges = sanitizeEdges(normalizeEdges(c.edges || []));
              
              return {
                ...c,
                nodes: resolved,
                edges: normalizedEdges,
              };
            });
          }
        }
      },
    }
  )
);

function deriveNodesAndEdges(state: DiagramState) {
  if (!state) return state;
  return new Proxy(state, {
    get(target, prop, receiver) {
      if (prop === 'nodes') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.nodes || [];
      }
      if (prop === 'edges') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.edges || [];
      }
      if (prop === 'cloudProvider') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.cloudProvider ?? 'off';
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zustand store wrapper needs flexible selector/equalityFn types for generic subscriber compatibility
export const useDiagramStore = Object.assign(
  (selector?: (state: DiagramState) => unknown, equalityFn?: (a: unknown, b: unknown) => boolean) => {
    if (selector) {
      const wrappedSelector = (state: DiagramState) => {
        const proxied = deriveNodesAndEdges(state);
        return selector(proxied);
      };
      return (useDiagramStoreRaw as (selector: (state: DiagramState) => unknown, equalityFn?: (a: unknown, b: unknown) => boolean) => unknown)(wrappedSelector, equalityFn);
    }
    const state = useDiagramStoreRaw();
    return deriveNodesAndEdges(state);
  },
  {
    getState: () => deriveNodesAndEdges(useDiagramStoreRaw.getState()),
    setState: useDiagramStoreRaw.setState,
    subscribe: (listener: (state: DiagramState, prevState: DiagramState) => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zustand subscribe callback signature is complex
      return (useDiagramStoreRaw.subscribe as any)((state: any, prevState: any) => {
        listener(deriveNodesAndEdges(state), deriveNodesAndEdges(prevState));
      });
    },
  }
) as typeof useDiagramStoreRaw;
