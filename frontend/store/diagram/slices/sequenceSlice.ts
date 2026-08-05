import type { StateCreator } from 'zustand';
import type { DiagramState } from '../types';

export type SequenceSlice = Pick<
  DiagramState,
  'sequenceDiagrams' | 'setSequenceDiagram' | 'clearSequenceDiagram' | 'importSequenceDiagram'
>;

export const createSequenceSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  SequenceSlice
> = (set, get) => ({
  sequenceDiagrams: {},

  setSequenceDiagram: (canvasId: string, mermaidSyntax: string, title: string) => {
    set((state) => ({
      sequenceDiagrams: {
        ...state.sequenceDiagrams,
        [canvasId]: { mermaidSyntax, title },
      },
    }));
  },

  clearSequenceDiagram: (canvasId: string) => {
    set((state) => {
      const { [canvasId]: _, ...rest } = state.sequenceDiagrams;
      return { sequenceDiagrams: rest };
    });
  },

  importSequenceDiagram: (mermaidSyntax: string, title: string) => {
    const canvasId = get().activeCanvasId;
    set((state) => ({
      sequenceDiagrams: {
        ...state.sequenceDiagrams,
        [canvasId]: { mermaidSyntax, title },
      },
      canvases: state.canvases.map((c) =>
        c.id === canvasId ? { ...c, nodes: [], edges: [], updatedAt: Date.now() } : c
      ),
    }));
    get().saveCanvasToDB(canvasId);
  },
});
