import { describe, it, expect, beforeEach } from 'vitest';
import { Position, type Edge, type Node } from 'reactflow';
import { useDiagramStore } from '../diagramStore';
import { computeEdgeRoute } from '@/lib/utils/edgeRouteBuilder';

function positionToHandleId(position: Position, role: 'source' | 'target'): string {
  const side =
    position === Position.Left
      ? 'left'
      : position === Position.Right
        ? 'right'
        : position === Position.Top
          ? 'top'
          : 'bottom';
  return `${role}-${side}`;
}

const nodeA: Node = {
  id: 'a',
  type: 'shapeNode',
  position: { x: 0, y: 0 },
  width: 160,
  height: 80,
  data: { label: 'A', category: 'default', typeId: 'default', color: '#6366f1', icon: 'Box' },
};

const nodeB: Node = {
  id: 'b',
  type: 'shapeNode',
  position: { x: 320, y: 0 },
  width: 160,
  height: 80,
  data: { label: 'B', category: 'default', typeId: 'default', color: '#6366f1', icon: 'Box' },
};

describe('recalculateHandles', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      activeLayoutPresetId: 'layered-lr',
      canvases: [
        {
          id: 'test-canvas',
          name: 'Test',
          nodes: [nodeA, nodeB],
          edges: [],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
      activeCanvasId: 'test-canvas',
      openCanvasIds: ['test-canvas'],
    });
  });

  it('assigns handles that match computeEdgeRoute for a clear LR pair', () => {
    const edge: Edge = {
      id: 'e-ab',
      source: 'a',
      target: 'b',
      type: 'simpleFloating',
    };

    useDiagramStore.setState({
      canvases: [
        {
          id: 'test-canvas',
          name: 'Test',
          nodes: [nodeA, nodeB],
          edges: [edge],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
    });

    useDiagramStore.getState().recalculateHandles();

    const { nodes, edges } = useDiagramStore.getState();
    const updated = edges.find((e) => e.id === 'e-ab');
    expect(updated?.sourceHandle).toBeTruthy();
    expect(updated?.targetHandle).toBeTruthy();

    const route = computeEdgeRoute(updated!, nodes, edges, 'LR');
    expect(updated!.sourceHandle).toBe(positionToHandleId(route.sourcePosition, 'source'));
    expect(updated!.targetHandle).toBe(positionToHandleId(route.targetPosition, 'target'));
  });

  it('updates handles when layout direction preset changes', () => {
    const edge: Edge = {
      id: 'e-ab',
      source: 'a',
      target: 'b',
      type: 'simpleFloating',
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
    };

    useDiagramStore.setState({
      activeLayoutPresetId: 'layered-tb',
      canvases: [
        {
          id: 'test-canvas',
          name: 'Test',
          nodes: [{ ...nodeA }, { ...nodeB, position: { x: 0, y: 280 } }],
          edges: [edge],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
    });

    useDiagramStore.getState().recalculateHandles();

    const { nodes, edges } = useDiagramStore.getState();
    const updated = edges[0];
    const route = computeEdgeRoute(updated, nodes, edges, 'TD');
    expect(updated.sourceHandle).toBe(positionToHandleId(route.sourcePosition, 'source'));
    expect(updated.targetHandle).toBe(positionToHandleId(route.targetPosition, 'target'));
  });
});
