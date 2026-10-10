import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from 'reactflow';
import { useDiagramStore } from '../diagramStore';

describe('importDiagram', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      past: [],
      future: [],
      canvases: [
        {
          id: 'import-canvas',
          name: 'Import',
          nodes: [],
          edges: [],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
      activeCanvasId: 'import-canvas',
      openCanvasIds: ['import-canvas'],
    });
  });

  it('preserves parentId on imported nodes', () => {
    const nodes: Node[] = [
      {
        id: 'group-1',
        type: 'groupNode',
        position: { x: 0, y: 0 },
        data: { label: 'Group' },
      },
      {
        id: 'child-1',
        type: 'systemNode',
        position: { x: 10, y: 10 },
        parentId: 'group-1',
        data: { label: 'Child', category: 'Compute' },
      },
    ];

    useDiagramStore.getState().importDiagram(nodes, []);

    const imported = useDiagramStore.getState().nodes;
    const child = imported.find((n) => n.id === 'child-1');
    expect(child?.parentId).toBe('group-1');
  });

  it('assigns handles to imported edges', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'A', category: 'Compute' } },
      { id: 'b', type: 'systemNode', position: { x: 300, y: 0 }, data: { label: 'B', category: 'Compute' } },
    ];

    useDiagramStore.getState().importDiagram(nodes, [
      { id: 'e1', source: 'a', target: 'b', data: {} },
    ]);

    const edge = useDiagramStore.getState().edges[0];
    expect(edge?.sourceHandle).toBeTruthy();
    expect(edge?.targetHandle).toBeTruthy();
  });

  it('preserves authored parallel edges and positions for JSON imports', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'systemNode', position: { x: 123, y: 71 }, data: { label: 'A' } },
      { id: 'b', type: 'systemNode', position: { x: 400, y: 91 }, data: { label: 'B' } },
    ];
    const edges = [
      { id: 'request', source: 'a', target: 'b', label: 'request', data: { label: 'request' } },
      { id: 'event', source: 'a', target: 'b', label: 'event', data: { label: 'event' } },
      { id: 'response', source: 'b', target: 'a', label: 'response', data: { label: 'response', isReturn: true } },
    ];
    useDiagramStore.getState().importDiagram(nodes, edges as never, { preserveTopology: true });
    expect(useDiagramStore.getState().nodes.find(n => n.id === 'a')?.position).toEqual({ x: 123, y: 71 });
    expect(useDiagramStore.getState().edges.map(e => e.id).sort()).toEqual(['event', 'request', 'response']);
  });
});
