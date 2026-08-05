import type { StateCreator } from 'zustand';
import type { CanvasTab, DiagramState } from './types';

export function deriveNodesAndEdges(state: DiagramState) {
  if (!state) return state;
  return new Proxy(state, {
    get(target, prop, receiver) {
      if (prop === 'nodes') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.nodes || [];
      }
      if (prop === 'edges') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.edges || [];
      }
      if (prop === 'cloudProvider') {
        const active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
        return active?.cloudProvider ?? 'off';
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function wrapCreator(
  creator: StateCreator<DiagramState, [['zustand/persist', unknown]]>
): StateCreator<DiagramState, [['zustand/persist', unknown]]> {
  return (set, getRaw, api) => {
    const get = () => deriveNodesAndEdges(getRaw());
    return creator(set, get, api);
  };
}
