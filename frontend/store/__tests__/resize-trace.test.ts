import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagramStore';
import type { Node } from 'reactflow';

const groupNode: Node = {
  id: 'grp-1',
  type: 'groupNode',
  position: { x: 100, y: 50 },
  style: { width: 300, height: 200 },
  width: 300,
  height: 200,
  data: { label: 'Group', groupLabel: 'Group', isGroup: true },
};

beforeEach(() => {
  const s = useDiagramStore.getState();
  s.clearDiagram();
  useDiagramStore.setState({
    canvases: [
      {
        id: s.activeCanvasId,
        name: 't',
        nodes: [],
        edges: [],
      },
    ],
  });
  useDiagramStore.getState().importDiagram([groupNode], []);
});

describe('resize trace', () => {
  it('applies NodeResizer position+dimensions batch atomically', () => {
    // Simulate dragging the LEFT handle inward: width shrinks by 40, position.x
    // must grow by 40 so the RIGHT edge stays fixed (xyflow issue #2575).
    const store = useDiagramStore.getState();
    store.onNodesChange([
      { id: 'grp-1', type: 'position', position: { x: 140, y: 50 } },
      {
        id: 'grp-1',
        type: 'dimensions',
        dimensions: { width: 260, height: 200 },
        updateStyle: true,
        resizing: true,
      },
    ]);

    const node = useDiagramStore.getState().nodes.find((n) => n.id === 'grp-1');
    expect(node?.position.x).toBe(140);
    expect(node?.width).toBe(260);
    expect(node?.position.x + (node?.width ?? 0)).toBe(400); // right edge preserved
  });

  it('keeps left edge fixed when dragging right handle', () => {
    const store = useDiagramStore.getState();
    store.onNodesChange([
      { id: 'grp-1', type: 'position', position: { x: 100, y: 50 } },
      {
        id: 'grp-1',
        type: 'dimensions',
        dimensions: { width: 340, height: 200 },
        updateStyle: true,
        resizing: true,
      },
    ]);
    const node = useDiagramStore.getState().nodes.find((n) => n.id === 'grp-1');
    expect(node?.position.x).toBe(100);
    expect(node?.width).toBe(340);
  });
});
