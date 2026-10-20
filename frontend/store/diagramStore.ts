import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deferredJSONStorage, migrateLegacyStorage } from '@/lib/client/localStorage';
import type { DiagramState } from './diagram/types';
import { deriveNodesAndEdges, wrapCreator } from './diagram/derive';
import { diagramPersistPartialize } from './diagram/persistence/partialize';
import { onDiagramRehydrate } from './diagram/persistence/rehydrate';
import { createSelectionSlice } from './diagram/slices/selectionSlice';
import { createUiSlice } from './diagram/slices/uiSlice';
import { createHistorySlice } from './diagram/slices/historySlice';
import { createCanvasSlice } from './diagram/slices/canvasSlice';
import { createPersistenceSlice } from './diagram/slices/persistenceSlice';
import { createSequenceSlice } from './diagram/slices/sequenceSlice';
import { createPipelineSlice } from './diagram/slices/pipelineSlice';
import { createEdgeEditSlice } from './diagram/slices/edgeEditSlice';
import { createGraphSlice } from './diagram/slices/graphSlice';
import { registerFitViewCallback } from './diagram/fitView';
import { installCanvasAutoSave } from './diagram/persistence/autoSave';
import { installAuthSync } from './diagram/authSync';
import { onAppTheme } from '@/lib/theme/themeBridge';

export type { GuideLine, NodeData, CanvasTab, UserProfile } from './diagram/types';
export { registerFitViewCallback };

migrateLegacyStorage();

function migrateDiagramState(persistedState: unknown, version: number): DiagramState {
  const state = (persistedState ?? {}) as Partial<DiagramState>;

  // Move users who were still on the untouched original defaults to the new
  // default once, while preserving any other saved appearance choice.
  if (
    version < 1 &&
    state.diagramStyleTheme === 'default' &&
    state.diagramRenderStyle === 'precision'
  ) {
    return {
      ...state,
      diagramStyleTheme: 'studio-minimal',
      diagramRenderStyle: 'studio-minimal',
    } as DiagramState;
  }

  return state as DiagramState;
}

const useDiagramStoreRaw = create<DiagramState>()(
  persist(
    wrapCreator((set, get, api) => ({
      ...createSelectionSlice(set, get, api),
      ...createUiSlice(set, get, api),
      ...createHistorySlice(set, get, api),
      ...createCanvasSlice(set, get, api),
      ...createPersistenceSlice(set, get, api),
      ...createSequenceSlice(set, get, api),
      ...createPipelineSlice(set, get, api),
      ...createEdgeEditSlice(set, get, api),
      ...createGraphSlice(set, get, api),
    })),
    {
      name: 'archdraw-storage',
      version: 1,
      migrate: migrateDiagramState,
      storage: deferredJSONStorage,
      partialize: diagramPersistPartialize,
      onRehydrateStorage: onDiagramRehydrate,
    }
  )
);

// Persist canvases from one subscription instead of per-mutation calls.
// Installed after hydration so restoring from localStorage doesn't re-save
// every canvas on page load.
if (typeof window !== 'undefined') {
  let installed = false;
  const install = () => {
    if (installed) return;
    installed = true;
    installCanvasAutoSave(useDiagramStoreRaw);
    // After rehydration, so the persisted profile and canvases are in place before sign-in merges into them.
    installAuthSync(useDiagramStoreRaw);
  };
  if (useDiagramStoreRaw.persist.hasHydrated()) install();
  else useDiagramStoreRaw.persist.onFinishHydration(install);
  // store.darkMode mirrors the app theme (next-themes, via ThemeProvider).
  onAppTheme((isDark) => {
    if (useDiagramStoreRaw.getState().darkMode !== isDark) useDiagramStoreRaw.setState({ darkMode: isDark });
  });
}

export const useDiagramStore = Object.assign(
  (selector?: (state: DiagramState) => unknown) => {
    if (selector) {
      // zustand v5 hooks take no equality fn; use `useShallow` for object selectors.
      const wrappedSelector = (state: DiagramState) => selector(deriveNodesAndEdges(state));
      return (useDiagramStoreRaw as (selector: (state: DiagramState) => unknown) => unknown)(wrappedSelector);
    }
    const state = useDiagramStoreRaw();
    return deriveNodesAndEdges(state);
  },
  {
    getState: () => deriveNodesAndEdges(useDiagramStoreRaw.getState()),
    setState: useDiagramStoreRaw.setState,
    subscribe: (listener: (state: DiagramState, prevState: DiagramState) => void) => {
      return useDiagramStoreRaw.subscribe((state, prevState) => {
        listener(deriveNodesAndEdges(state), deriveNodesAndEdges(prevState));
      });
    },
  }
) as typeof useDiagramStoreRaw;
