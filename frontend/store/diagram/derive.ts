import type { StateCreator } from 'zustand';
import type { Node } from 'reactflow';
import type { CanvasTab, DiagramState } from './types';

const EMPTY: never[] = [];

// Store snapshots are immutable (every set() makes a new object), so one Proxy
// per snapshot is enough. Previously every selector call and getState()
// allocated a fresh Proxy and re-searched `canvases` on each property read.
const derivedBySnapshot = new WeakMap<DiagramState, DiagramState>();

export function deriveNodesAndEdges(state: DiagramState) {
  if (!state) return state;
  const cached = derivedBySnapshot.get(state);
  if (cached) return cached;
  let active: CanvasTab | undefined;
  let resolved = false;
  const getActive = (target: DiagramState) => {
    if (!resolved) {
      active = target.canvases?.find((c: CanvasTab) => c.id === target.activeCanvasId);
      resolved = true;
    }
    return active;
  };
  const derived = new Proxy(state, {
    get(target, prop, receiver) {
      if (prop === 'nodes') return getActive(target)?.nodes || EMPTY;
      if (prop === 'edges') return getActive(target)?.edges || EMPTY;
      if (prop === 'cloudProvider') return getActive(target)?.cloudProvider ?? 'off';
      return Reflect.get(target, prop, receiver);
    },
  });
  derivedBySnapshot.set(state, derived);
  return derived;
}

export function wrapCreator(
  creator: StateCreator<DiagramState, [['zustand/persist', unknown]]>
): StateCreator<DiagramState, [['zustand/persist', unknown]]> {
  return (set, getRaw, api) => {
    const get = () => deriveNodesAndEdges(getRaw());
    return creator(set, get, api);
  };
}

const nodeIndexByArray = new WeakMap<readonly Node[], Map<string, Node>>();

/** O(1) node lookup by id, indexed once per (immutable) nodes array. */
export function findNodeById(nodes: readonly Node[], id: string): Node | undefined {
  let index = nodeIndexByArray.get(nodes);
  if (!index) {
    index = new Map(nodes.map((n) => [n.id, n]));
    nodeIndexByArray.set(nodes, index);
  }
  return index.get(id);
}
