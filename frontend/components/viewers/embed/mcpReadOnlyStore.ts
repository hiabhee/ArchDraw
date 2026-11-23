import type { DiagramState } from '@/store/diagram/types';

// The widget bundle substitutes this adapter for the editor store. Shared
// components get the real graph from CanvasHostProvider. This adapter has no
// authentication, network calls, saved preferences, or graph mutations.
const defaults = {
  nodes: [],
  edges: [],
  darkMode: true,
  diagramRenderStyle: 'studio-metallic',
  diagramStyleTheme: 'studio-minimal',
  iconMode: 'all',
} satisfies Partial<DiagramState>;

export const useDiagramStore = Object.assign(
  <Selected>(selector: (state: typeof defaults) => Selected): Selected => selector(defaults),
  { getState: () => defaults, subscribe: () => () => {} },
);
