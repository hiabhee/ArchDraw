import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagramStore';

const tab = (id: string, agenticProjectId: string | null = null) => ({
  id,
  name: id,
  nodes: [],
  edges: [],
  isOpen: true,
  updatedAt: Date.now(),
  agenticProjectId,
});

describe('openTabIfLiveProject', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      userProfile: { id: 'user-1' },
      canvases: [tab('live', 'proj-1'), tab('plain')],
      openCanvasIds: ['live', 'plain'],
      activeCanvasId: 'live',
      past: [],
      future: [],
    } as never);
  });

  it('opens a new tab for a live project and makes it active', () => {
    const ok = useDiagramStore.getState().openTabIfLiveProject();
    const state = useDiagramStore.getState();

    expect(ok).toBe(true);
    expect(state.activeCanvasId).not.toBe('live');
    expect(state.canvases.find((c) => c.id === 'live')?.agenticProjectId).toBe('proj-1');
  });

  it('leaves a non-live canvas alone', () => {
    useDiagramStore.setState({ activeCanvasId: 'plain' } as never);

    expect(useDiagramStore.getState().openTabIfLiveProject()).toBe(true);
    expect(useDiagramStore.getState().activeCanvasId).toBe('plain');
    expect(useDiagramStore.getState().canvases).toHaveLength(2);
  });

  it('reports false when the new tab is refused, so the live map is not replaced', () => {
    // A signed-in user at the canvas limit: addCanvas keeps the active id.
    const maxCanvases = 5;
    const filled = Array.from({ length: maxCanvases }, (_, i) => tab(`c${i}`, i === 0 ? 'proj-1' : null));
    useDiagramStore.setState({
      canvases: filled,
      openCanvasIds: filled.map((c) => c.id),
      activeCanvasId: 'c0',
    } as never);

    expect(useDiagramStore.getState().openTabIfLiveProject()).toBe(false);
    expect(useDiagramStore.getState().activeCanvasId).toBe('c0');
  });
});
