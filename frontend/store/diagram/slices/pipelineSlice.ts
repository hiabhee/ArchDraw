import type { StateCreator } from 'zustand';
import type { Edge, Node } from 'reactflow';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import type { DiagramState } from '../types';
import { normalizeNodes, normalizeNodeType } from '../helpers/nodeHelpers';
import { normalizeEdges, normalizeEdge } from '../helpers/edgeHelpers';

export type PipelineSlice = Pick<
  DiagramState,
  | 'pipelineStatus'
  | 'pipelineError'
  | 'setNodes'
  | 'setEdges'
  | 'appendNode'
  | 'appendEdge'
  | 'startGeneration'
  | 'markPipelineDone'
  | 'markPipelineError'
  | 'clearPipelineStatus'
>;

export const createPipelineSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  PipelineSlice
> = (set, get) => ({
  pipelineStatus: 'idle',
  pipelineError: null,

  setNodes: (nodes) => {
    const validatedNodes = validateAndFixNodes(normalizeNodes(nodes));
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes: validatedNodes, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  setEdges: (edges) => {
    const normalized = normalizeEdges(edges);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges: normalized, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  appendNode: (node) => {
    const nodes = [...get().nodes, { ...node, type: normalizeNodeType(node.type as string | undefined) }];
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  appendEdge: (edge) => {
    const edges = [...get().edges, normalizeEdge(edge)];
    const canvases = get().canvases.map((c) =>
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
  markPipelineError: (message: string) => set({ pipelineStatus: 'error', pipelineError: message }),
  clearPipelineStatus: () => set({ pipelineStatus: 'idle', pipelineError: null }),
});
