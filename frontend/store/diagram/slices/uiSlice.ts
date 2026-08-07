import type { StateCreator } from 'zustand';
import { applyThemeChange } from '@/lib/themeBridge';
import type { DiagramState } from '../types';

export type UiSlice = Pick<
  DiagramState,
  | 'guideLines'
  | 'edgeAnimations'
  | 'showGrid'
  | 'showNodeIcons'
  | 'diagramChromeMode'
  | 'diagramStyleTheme'
  | 'darkMode'
  | 'sidebarOpen'
  | 'canvasMode'
  | 'activeLayoutPresetId'
  | 'detailLevel'
  | 'isPenModeActive'
  | 'setGuideLines'
  | 'toggleEdgeAnimations'
  | 'toggleGrid'
  | 'toggleNodeIcons'
  | 'setShowNodeIcons'
  | 'setCloudProvider'
  | 'setDiagramChromeMode'
  | 'setDiagramStyleTheme'
  | 'toggleDarkMode'
  | 'setSidebarOpen'
  | 'setCanvasMode'
  | 'setActiveLayoutPresetId'
  | 'setDetailLevel'
  | 'setPenModeActive'
>;

const isBrowser = typeof window !== 'undefined';

export const createUiSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  UiSlice
> = (set, get) => ({
  guideLines: [],
  edgeAnimations: true,
  showGrid: true,
  showNodeIcons: true,
  diagramChromeMode: 'edit',
  diagramStyleTheme: 'default',
  darkMode: isBrowser ? window.localStorage.getItem('archdraw-theme') === 'dark' : false,
  sidebarOpen: false,
  canvasMode: 'empty',
  activeLayoutPresetId: 'layered-lr',
  detailLevel: 3,
  isPenModeActive: false,
  setGuideLines: (lines) => set({ guideLines: lines }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  setActiveLayoutPresetId: (id) => set({ activeLayoutPresetId: id }),
  setDetailLevel: (level) => set({ detailLevel: level }),
  setPenModeActive: (active) => set({ isPenModeActive: active }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  toggleNodeIcons: () => set({ showNodeIcons: !get().showNodeIcons }),
  setShowNodeIcons: (show) => set({ showNodeIcons: show }),
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
    applyThemeChange(!get().darkMode);
  },
  toggleEdgeAnimations: () => {
    const next = !get().edgeAnimations;
    const edges = get().edges.map((e) => ({ ...e, animated: next }));
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ edgeAnimations: next, canvases });
  },
});
