import logger from '@/lib/logger';

const isBrowser = typeof window !== 'undefined';

let writeChain: Promise<void> = Promise.resolve();

export const serializedStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return;
    writeChain = writeChain.then(() => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage unavailable — silently ignore
      }
    });
  },
  removeItem: (key: string): void => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
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
