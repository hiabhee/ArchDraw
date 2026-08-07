import type { DiagramState } from '../types';

/** Fields written to localStorage via Zustand persist. */
export function diagramPersistPartialize(s: DiagramState) {
  return {
    canvases: s.canvases,
    activeCanvasId: s.activeCanvasId,
    edgeAnimations: s.edgeAnimations,
    showGrid: s.showGrid,
    iconMode: s.iconMode,
    diagramChromeMode: s.diagramChromeMode,
    diagramStyleTheme: s.diagramStyleTheme,
    userProfile: s.userProfile,
  };
}
