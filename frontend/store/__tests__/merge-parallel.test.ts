import { describe, it, expect } from 'vitest';
import { useDiagramStore } from '../diagramStore';

function validNode(id: string, label: string) {
  return {
    id,
    position: { x: 100, y: 100 },
    data: {
      typeId: 'server',
      label,
      color: '#6366f1',
      category: 'compute',
      icon: 'Server',
    },
    type: 'systemNode',
  };
}

describe('parallel edge merge (store paths)', () => {
  it('importDiagram merges two edges between same nodes and combines labels', () => {
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      activeCanvasId: 'c1',
      canvases: [
        {
          id: 'c1',
          name: 'Test',
          nodes: [],
          edges: [],
          cloudProvider: 'off',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    } as any);

    const edges = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'simpleFloating',
        label: 'queries',
        data: { label: 'queries', connectionType: 'sync' },
      },
      {
        id: 'e2',
        source: 'a',
        target: 'b',
        type: 'simpleFloating',
        label: 'writes',
        data: { label: 'writes', connectionType: 'sync' },
      },
    ];

    useDiagramStore.getState().importDiagram(
      [validNode('a', 'A'), validNode('b', 'B')],
      edges as any
    );

    const result = useDiagramStore.getState().edges;
    console.log('FULL EDGES:', JSON.stringify(result, null, 2));
    const betweenAB = result.filter(
      (e) =>
        (e.source === 'a' && e.target === 'b') ||
        (e.source === 'b' && e.target === 'a')
    );
    expect(betweenAB).toHaveLength(1);
    console.log('MERGED EDGE:', JSON.stringify(betweenAB[0], null, 2));
    expect(betweenAB[0].label).toBe('queries / writes');
  });

  it('onConnect absorbs a second connection into the existing edge label', () => {
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      activeCanvasId: 'c1',
      canvases: [
        {
          id: 'c1',
          name: 'Test',
          nodes: [],
          edges: [],
          cloudProvider: 'off',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    } as any);

    useDiagramStore.getState().importDiagram(
      [validNode('a', 'A'), validNode('b', 'B')],
      [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          type: 'simpleFloating',
          label: 'queries',
          data: { label: 'queries', connectionType: 'sync' },
        },
      ] as any
    );

    useDiagramStore.getState().onConnect({
      source: 'a',
      target: 'b',
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    } as any);

    const result = useDiagramStore.getState().edges;
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('queries');
    expect((result[0].data as any).label).toBe('queries');
    expect(useDiagramStore.getState().pendingLabelEdgeId).toBeNull();
  });
});
