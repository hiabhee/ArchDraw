import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagramStore';

describe('history slice', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      past: [],
      future: [],
      canvases: [
        {
          id: 'hist-canvas',
          name: 'Hist',
          nodes: [],
          edges: [],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
      activeCanvasId: 'hist-canvas',
      openCanvasIds: ['hist-canvas'],
    });
  });

  it('undo restores prior nodes after pushHistory', () => {
    const store = useDiagramStore.getState();
    store.pushHistory();
    store.addNode('undo-node', 'Before undo');
    expect(useDiagramStore.getState().nodes).toHaveLength(1);

    store.undo();
    expect(useDiagramStore.getState().nodes).toHaveLength(0);
    expect(useDiagramStore.getState().future).toHaveLength(1);
  });
});
