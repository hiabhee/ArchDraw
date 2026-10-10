import logger from '@/lib/logger';

const isBrowser = typeof window !== 'undefined';

// Coalesce graph snapshots before serialization and disk writes. Pending values
// remain readable so a rehydrate cannot observe an older on-disk snapshot.
const pending = new Map<string, string | (() => string)>();
let writeTimer: ReturnType<typeof setTimeout> | undefined;
export function flushDiagramStorage(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = undefined;
  for (const [key, value] of pending) {
    try { localStorage.setItem(key, typeof value === 'function' ? value() : value); } catch { /* Storage unavailable */ }
  }
  pending.clear();
}
function queueWrite(key: string, value: string | (() => string)): void {
  if (!isBrowser) return;
  pending.set(key, value);
  // A bounded interval rather than a resetting debounce also saves long drags.
  if (!writeTimer) writeTimer = setTimeout(flushDiagramStorage, 200);
}
if (isBrowser) {
  window.addEventListener('pagehide', flushDiagramStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDiagramStorage();
  });
}
export const serializedStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    const value = pending.get(key);
    if (value !== undefined) return typeof value === 'function' ? value() : value;
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => queueWrite(key, value),
  removeItem: (key: string): void => {
    pending.delete(key);
    if (!isBrowser) return;
    try { localStorage.removeItem(key); } catch { /* Storage unavailable */ }
  },
};

/** Zustand storage: serialize only the latest snapshot at the flush boundary. */
export const deferredJSONStorage = {
  getItem: (key: string) => {
    const value = serializedStorage.getItem(key);
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
  },
  setItem: (key: string, value: unknown): void => queueWrite(key, () => JSON.stringify(value)),
  removeItem: serializedStorage.removeItem,
};

export function migrateLegacyStorage(): void {
  if (!isBrowser) return;
  try {
    const raw = localStorage.getItem('archdraw-storage');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.state) return;
    const state = parsed.state;
    if ((state.nodes !== undefined || state.edges !== undefined) && state.activeCanvasId) {
      const activeId = state.activeCanvasId;
      const canvases = state.canvases || [];
      const canvasIndex = canvases.findIndex((c: { id: string }) => c.id === activeId);
      if (canvasIndex !== -1) {
        const canvas = canvases[canvasIndex];
        const topNodes = state.nodes || [];
        const canvasNodes = canvas.nodes || [];
        const topEdges = state.edges || [];
        const canvasEdges = canvas.edges || [];
        const useTop = topNodes.length > canvasNodes.length || (state.updatedAt || 0) > (canvas.updatedAt || 0);
        canvases[canvasIndex] = {
          ...canvas,
          nodes: useTop ? topNodes : canvasNodes,
          edges: useTop ? topEdges : canvasEdges,
          updatedAt: Math.max(state.updatedAt || 0, canvas.updatedAt || 0, Date.now()),
        };
      }
      delete state.nodes;
      delete state.edges;
      localStorage.setItem('archdraw-storage', JSON.stringify({ ...parsed, state }));
    }
  } catch (e) {
    logger.error('[Migration] Failed to migrate duplicate nodes/edges:', e);
  }
}
