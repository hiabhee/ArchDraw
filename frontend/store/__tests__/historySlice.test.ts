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

  describe('undo/redo behavior', () => {
    const node = (id: string, x = 0, label = id) => ({
      id,
      type: 'systemNode',
      position: { x, y: 0 },
      data: { label },
      width: 160,
      height: 100,
    });

    beforeEach(() => {
      useDiagramStore.setState({
        past: [],
        future: [],
        canvases: [
          {
            id: 'hist-canvas',
            name: 'Hist',
            nodes: [node('a'), node('b')],
            edges: [],
            isOpen: true,
            updatedAt: Date.now(),
          },
        ],
        activeCanvasId: 'hist-canvas',
        openCanvasIds: ['hist-canvas'],
        selectedNodeIds: [],
        selectedNodeId: null,
        selectedEdgeId: null,
      } as never);
    });

    const setNodesDirect = (nodes: unknown[]) => {
      useDiagramStore.setState((st) => ({
        canvases: st.canvases.map((c) => (c.id === 'hist-canvas' ? { ...c, nodes } : c)),
      }) as never);
    };

    it('undo reverts a label edit made through updateNodeData', () => {
      useDiagramStore.getState().updateNodeData('a', { label: 'Renamed' });
      expect(useDiagramStore.getState().nodes.find((n) => n.id === 'a')?.data.label).toBe('Renamed');
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().nodes.find((n) => n.id === 'a')?.data.label).toBe('a');
    });

    it('records a drag as one step that undo fully reverts', () => {
      // What Canvas does on drag start, then React Flow moves the node.
      useDiagramStore.getState().pushHistory();
      setNodesDirect([node('a', 300), node('b')]);
      setNodesDirect([node('a', 500), node('b')]);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().nodes.find((n) => n.id === 'a')?.position.x).toBe(0);
    });

    it('coalesces a burst of the same edit into one undo step', () => {
      const store = useDiagramStore.getState();
      store.updateNodeData('a', { label: 'R' });
      useDiagramStore.getState().updateNodeData('a', { label: 'Re' });
      useDiagramStore.getState().updateNodeData('a', { label: 'Ren' });
      expect(useDiagramStore.getState().past).toHaveLength(1);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().nodes.find((n) => n.id === 'a')?.data.label).toBe('a');
    });

    it('does not create an undo step for a patch that changes nothing', () => {
      useDiagramStore.getState().updateNodeData('a', { label: 'a' });
      expect(useDiagramStore.getState().past).toHaveLength(0);
    });

    it('does not record editor flags such as autoStartTextEdit', () => {
      useDiagramStore.getState().updateNodeData('a', { autoStartTextEdit: false } as never);
      expect(useDiagramStore.getState().past).toHaveLength(0);
    });

    it('redo replays the undone step and a new edit clears the redo stack', () => {
      useDiagramStore.getState().updateNodeData('a', { label: 'Renamed' });
      useDiagramStore.getState().undo();
      useDiagramStore.getState().redo();
      expect(useDiagramStore.getState().nodes.find((n) => n.id === 'a')?.data.label).toBe('Renamed');

      useDiagramStore.getState().undo();
      useDiagramStore.getState().updateNodeData('b', { label: 'Other' });
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    it('drops selection of nodes that undo removes', () => {
      const store = useDiagramStore.getState();
      store.pushHistory();
      setNodesDirect([node('a')]);
      useDiagramStore.setState({ selectedNodeIds: ['b'], selectedNodeId: 'b' } as never);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().nodes.map((n) => n.id)).toEqual(['a', 'b']);
      // 'b' exists again after undo; selection of missing ids is cleared.
      setNodesDirect([node('a')]);
      useDiagramStore.setState({ selectedNodeIds: ['b'], selectedNodeId: 'b' } as never);
      useDiagramStore.getState().redo();
      expect(useDiagramStore.getState().selectedNodeIds).toEqual([]);
      expect(useDiagramStore.getState().selectedNodeId).toBeNull();
    });

    it('caps the undo stack', () => {
      for (let i = 0; i < 150; i += 1) {
        useDiagramStore.getState().pushHistory();
      }
      expect(useDiagramStore.getState().past.length).toBe(100);
    });
  });
});
