import type { StateCreator } from 'zustand';
import type { DiagramState } from '../types';

export type HistorySlice = Pick<DiagramState, 'past' | 'future' | 'pushHistory' | 'undo' | 'redo'>;

export const createHistorySlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  HistorySlice
> = (set, get) => ({
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
      c.id === activeCanvasId ? { ...c, nodes: prev.nodes, edges: prev.edges, updatedAt: Date.now() } : c
    );
    set({ past: past.slice(0, -1), future: [{ nodes, edges }, ...future], canvases: newCanvases });
  },
  redo: () => {
    const { future, nodes, edges, past, activeCanvasId, canvases } = get();
    if (!future.length) return;
    const next = future[0];
    const newCanvases = canvases.map((c) =>
      c.id === activeCanvasId ? { ...c, nodes: next.nodes, edges: next.edges, updatedAt: Date.now() } : c
    );
    set({ future: future.slice(1), past: [...past, { nodes, edges }], canvases: newCanvases });
  },
});
