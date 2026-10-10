import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deferredJSONStorage, migrateLegacyStorage } from '@/lib/storage/localStorage';
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
      return useDiagramStoreRaw.subscribe((state, prevState) => {
        listener(deriveNodesAndEdges(state), deriveNodesAndEdges(prevState));
      });
    },
  }
) as typeof useDiagramStoreRaw;
