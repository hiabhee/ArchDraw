import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { serializedStorage, migrateLegacyStorage } from '@/lib/storage/localStorage';
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
      storage: createJSONStorage(() => serializedStorage),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zustand subscribe callback signature is complex
      return (useDiagramStoreRaw.subscribe as any)((state: any, prevState: any) => {
        listener(deriveNodesAndEdges(state), deriveNodesAndEdges(prevState));
      });
    },
  }
) as typeof useDiagramStoreRaw;
