import type { Edge, Node } from 'reactflow';
import type { CanvasTab } from '../types';

const isBrowser = typeof window !== 'undefined';

export function makeCanvas(name: string, id?: string): CanvasTab {
  const finalId = id ?? (isBrowser ? crypto.randomUUID() : 'canvas-1');

  return {
    id: finalId,
    name,
    nodes: [],
    edges: [],
    cloudProvider: 'off',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const INITIAL_CANVAS = makeCanvas('Elephant');

export function syncActiveCanvas(
  canvases: CanvasTab[],
  activeCanvasId: string,
  nodes: Node[],
  edges: Edge[]
): CanvasTab[] {
  return canvases.map((c) =>
    c.id === activeCanvasId ? { ...c, nodes, edges, updatedAt: Date.now() } : c
  );
}

export function mergeCanvases(localCanvases: CanvasTab[], dbCanvases: CanvasTab[]): CanvasTab[] {
  const merged = new Map<string, CanvasTab>();

  for (const c of dbCanvases) {
    if (!c.id) continue;
    merged.set(c.id, c);
  }

  for (const local of localCanvases) {
    if (!local.id) continue;
    const existing = merged.get(local.id);
    if (!existing) {
      merged.set(local.id, local);
    } else {
      const localTime = local.updatedAt || 0;
      const dbTime = existing.updatedAt || 0;
      if (localTime > dbTime) {
        merged.set(local.id, { ...local, isOpen: existing.isOpen, isPinned: existing.isPinned });
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
}
