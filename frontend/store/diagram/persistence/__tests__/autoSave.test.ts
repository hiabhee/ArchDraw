import { describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import type { CanvasTab, DiagramState } from '../../types';
import { changedCanvasIds, installCanvasAutoSave, withAutoSaveSuppressed } from '../autoSave';

const canvas = (id: string, nodes: Node[] = [], name = id): CanvasTab => ({ id, name, nodes, edges: [] });

describe('changedCanvasIds', () => {
  it('reports canvases whose nodes, edges or name changed — and new canvases', () => {
    const a = canvas('a'), b = canvas('b');
    const next = [{ ...a, nodes: [{ id: 'n' } as Node] }, b, canvas('c')];
    expect(changedCanvasIds([a, b], next)).toEqual(['a', 'c']);
    expect(changedCanvasIds([a, b], [a, { ...b, name: 'renamed' }])).toEqual(['b']);
  });

  it('ignores metadata-only changes (e.g. recording the server version)', () => {
    const a = canvas('a');
    expect(changedCanvasIds([a], [{ ...a, serverUpdatedAt: 5 }])).toEqual([]);
  });

  it('skips mid-drag frames', () => {
    const a = canvas('a');
    const dragging = { ...a, nodes: [{ id: 'n', dragging: true } as Node & { dragging: boolean }] };
    expect(changedCanvasIds([a], [dragging])).toEqual([]);
  });
});

describe('installCanvasAutoSave', () => {
  function fakeStore() {
    let listener: (s: DiagramState, p: DiagramState) => void = () => {};
    const saveCanvasToDB = vi.fn();
    return {
      saveCanvasToDB,
      store: { subscribe: (l: typeof listener) => { listener = l; return () => {}; } },
      emit: (prev: CanvasTab[], next: CanvasTab[]) =>
        listener({ canvases: next, saveCanvasToDB } as unknown as DiagramState, { canvases: prev } as unknown as DiagramState),
    };
  }

  it('saves changed canvases', () => {
    const f = fakeStore();
    installCanvasAutoSave(f.store);
    const a = canvas('a');
    f.emit([a], [{ ...a, name: 'x' }]);
    expect(f.saveCanvasToDB).toHaveBeenCalledWith('a');
  });

  it('does not echo server-originated updates back as saves', () => {
    const f = fakeStore();
    installCanvasAutoSave(f.store);
    const a = canvas('a');
    withAutoSaveSuppressed(() => f.emit([a], [{ ...a, name: 'from-db' }]));
    expect(f.saveCanvasToDB).not.toHaveBeenCalled();
  });
});
