import type { StateCreator } from 'zustand';
import type { DiagramState, HistoryEntry } from '../types';

export type HistorySlice = Pick<DiagramState, 'past' | 'future' | 'pushHistory' | 'undo' | 'redo'>;

/** Undo steps kept per session (the stack is cleared on canvas switch). */
export const HISTORY_LIMIT = 100;
/** Edits with the same coalesceKey closer than this collapse into one step. */
export const HISTORY_COALESCE_MS = 800;

/**
 * Stack model: `past` and `future` are LIFO (last element is the next step).
 * Undo/redo restore nodes and edges of the active canvas and drop selection
 * ids that no longer exist, so no ghost node stays selected.
 */
function restoreEntry(state: DiagramState, entry: HistoryEntry) {
  const nodeIds = new Set(entry.nodes.map((n) => n.id));
  const edgeIds = new Set(entry.edges.map((e) => e.id));
  const selectedNodeIds = state.selectedNodeIds.filter((id) => nodeIds.has(id));
  return {
    canvases: state.canvases.map((c) =>
      c.id === state.activeCanvasId
        ? { ...c, nodes: entry.nodes, edges: entry.edges, updatedAt: Date.now() }
        : c
    ),
    selectedNodeIds,
    selectedNodeId: state.selectedNodeId && nodeIds.has(state.selectedNodeId) ? state.selectedNodeId : null,
    selectedEdgeId: state.selectedEdgeId && edgeIds.has(state.selectedEdgeId) ? state.selectedEdgeId : null,
  };
}

export const createHistorySlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  HistorySlice
> = (set, get) => ({
  past: [],
  future: [],
  pushHistory: (opts) => {
    const { nodes, edges, past } = get();
    const now = Date.now();
    const key = opts?.coalesceKey;
    const last = past[past.length - 1];
    // Same gesture (e.g. a drag or a burst of label edits): keep the earliest
    // snapshot so one undo reverts the whole gesture.
    if (key && last && last.key === key && now - (last.at ?? 0) < HISTORY_COALESCE_MS) {
      set({ past: [...past.slice(0, -1), { ...last, at: now }] });
      return;
    }
    const next: HistoryEntry = { nodes, edges, key, at: now };
    set({ past: [...past, next].slice(-HISTORY_LIMIT), future: [] });
  },
  undo: () => {
    const state = get();
    const { past, future, nodes, edges } = state;
    if (!past.length) return;
    const prev = past[past.length - 1];
    const current: HistoryEntry = { nodes, edges, at: Date.now() };
    set({
      past: past.slice(0, -1),
      future: [...future, current].slice(-HISTORY_LIMIT),
      ...restoreEntry(state, prev),
    });
  },
  redo: () => {
    const state = get();
    const { future, past, nodes, edges } = state;
    if (!future.length) return;
    const next = future[future.length - 1];
    const current: HistoryEntry = { nodes, edges, at: Date.now() };
    set({
      future: future.slice(0, -1),
      past: [...past, current].slice(-HISTORY_LIMIT),
      ...restoreEntry(state, next),
    });
  },
});
