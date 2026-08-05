import type { StateCreator } from 'zustand';
import type { DiagramState } from '../types';

export type SelectionSlice = Pick<
  DiagramState,
  | 'selectedNodeId'
  | 'selectedNodeIds'
  | 'selectedEdgeId'
  | 'setSelectedNodeId'
  | 'setSelectedNodeIds'
  | 'setSelectedEdgeId'
>;

export const createSelectionSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  SelectionSlice
> = (set) => ({
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
});
