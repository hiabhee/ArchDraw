import type { StateCreator } from 'zustand';
import type { Connection, Edge } from 'reactflow';
import type { DiagramState } from '../types';
import { distributeTargetHandles } from '../helpers/edgeHelpers';

export type EdgeEditSlice = Pick<
  DiagramState,
  | 'editingEdgeId'
  | 'setEditingEdgeId'
  | 'pendingEditEdgeId'
  | 'setPendingEditEdgeId'
  | 'pendingLabelEdgeId'
  | 'setPendingLabelEdgeId'
  | 'updateEdgeLabel'
  | 'updateEdgeData'
  | 'deleteEdge'
  | 'onReconnect'
>;

export const createEdgeEditSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  EdgeEditSlice
> = (set, get) => ({
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
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  updateEdgeData: (edgeId, dataUpdates) => {
    const edges = get().edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, ...dataUpdates } } : e
    );
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  deleteEdge: (edgeId) => {
    get().pushHistory();
    const edges = get().edges.filter((e) => e.id !== edgeId);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ canvases, selectedEdgeId: null });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  onReconnect: (oldEdge, newConnection) => {
    get().pushHistory();
    const rawEdges = get().edges.map((e) => {
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
    const edges = distributeTargetHandles(get().nodes, rawEdges, get().activeLayoutPresetId);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },
});
