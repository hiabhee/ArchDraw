import type { Node } from 'reactflow';
import type { CanvasTab, DiagramState } from '../types';

/**
 * Single place that decides when a canvas needs persisting.
 *
 * Previously ~38 mutation sites each had to remember to call
 * `saveCanvasToDB`, and anything that forgot (or deliberately skipped, like
 * position changes) silently didn't save. Instead we watch the store: any
 * canvas whose nodes, edges or name changed is scheduled for a (per-canvas,
 * debounced) save. Mid-drag frames are skipped; the drag-end update saves.
 */

let suppressDepth = 0;

/** Apply server-originated state (DB load / reload) without echoing it back. */
export function withAutoSaveSuppressed<T>(fn: () => T): T {
  suppressDepth += 1;
  try {
    return fn();
  } finally {
    suppressDepth -= 1;
  }
}

const isDragging = (nodes: Node[]) => nodes.some((n) => (n as Node & { dragging?: boolean }).dragging === true);

export function changedCanvasIds(prev: CanvasTab[], next: CanvasTab[]): string[] {
  if (prev === next) return [];
  const before = new Map(prev.map((c) => [c.id, c]));
  const ids: string[] = [];
  for (const canvas of next) {
    const old = before.get(canvas.id);
    if (old && old.nodes === canvas.nodes && old.edges === canvas.edges && old.name === canvas.name) continue;
    if (isDragging(canvas.nodes ?? [])) continue;
    ids.push(canvas.id);
  }
  return ids;
}

type SubscribableStore = {
  subscribe: (listener: (state: DiagramState, prev: DiagramState) => void) => () => void;
};

export function installCanvasAutoSave(store: SubscribableStore): () => void {
  return store.subscribe((state, prev) => {
    if (suppressDepth > 0) return;
    for (const id of changedCanvasIds(prev.canvases ?? [], state.canvases ?? [])) {
      state.saveCanvasToDB(id);
    }
  });
}
