import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { Position, type Edge, type Node } from 'reactflow';
import { useHandleSlotLayout } from '../useHandleSlotLayout';
import { useDiagramStore } from '@/store/diagramStore';
import { computeEdgeRoute } from '@/lib/utils/edgeRouteBuilder';

const node = (id: string, x: number, y = 0): Node => ({
  id, type: 'systemNode', position: { x, y }, width: 200, height: 100, data: { label: id },
} as Node);

function loadGraph(nodes: Node[], edges: Edge[]) {
  useDiagramStore.setState({
    activeCanvasId: 'handle-test',
    canvases: [{ id: 'handle-test', name: 'Handle test', nodes, edges }],
    activeLayoutPresetId: 'layered-lr',
    diagramRenderStyle: 'precision',
  });
}

afterEach(cleanup);

describe('useHandleSlotLayout', () => {
  it('hides unused handles until the node is hovered or selected', () => {
    loadGraph([node('api', 0)], []);
    const { result } = renderHook(() => useHandleSlotLayout('api'));
    expect(result.current.shouldRenderHandle(Position.Right, 'source')).toBe(false);
    expect(result.current.shouldRenderHandle(Position.Right, 'target')).toBe(false);
    expect(result.current.isEmptySide(Position.Right)).toBe(true);
  });

  it('shows only the connected role when one edge uses a side', () => {
    const nodes = [node('source', 0), node('target', 400)];
    const edges = [{ id: 'edge', source: 'source', target: 'target' }] as Edge[];
    loadGraph(nodes, edges);
    const { result } = renderHook(() => useHandleSlotLayout('target'));
    expect(result.current.shouldRenderHandle(Position.Left, 'target')).toBe(true);
    expect(result.current.shouldRenderHandle(Position.Left, 'source')).toBe(false);
    expect(result.current.getSlotOffset(Position.Left, 'target')).toBe(0);
  });

  it('separates incoming and outgoing handles that share a side', () => {
    const nodes = [node('left', 0, -120), node('hub', 300), node('other', 0, 120)];
    const edges = [
      { id: 'in', source: 'left', target: 'hub', data: { targetSide: 'left' } },
      { id: 'out', source: 'hub', target: 'other', data: { sourceSide: 'left' } },
    ] as Edge[];
    loadGraph(nodes, edges);
    const { result } = renderHook(() => useHandleSlotLayout('hub'));
    expect(result.current.shouldRenderHandle(Position.Left, 'source')).toBe(true);
    expect(result.current.shouldRenderHandle(Position.Left, 'target')).toBe(true);
    expect(Math.abs(result.current.getSlotOffset(Position.Left, 'source'))).toBe(16);
    expect(result.current.getSlotOffset(Position.Left, 'source')).toBe(-result.current.getSlotOffset(Position.Left, 'target'));
    const incomingRoute = computeEdgeRoute(edges[0], nodes, edges);
    const outgoingRoute = computeEdgeRoute(edges[1], nodes, edges);
    const hubCenterY = nodes[1].position.y + (nodes[1].height ?? 0) / 2;
    expect(incomingRoute.targetPoint.y - hubCenterY).toBe(result.current.getSlotOffset(Position.Left, 'target'));
    expect(outgoingRoute.sourcePoint.y - hubCenterY).toBe(result.current.getSlotOffset(Position.Left, 'source'));
  });

  it('counts bidirectional edges on the same sides the router draws', () => {
    const nodes = [node('web', 0), node('api', 400)];
    const edges = [
      { id: 'request', source: 'web', target: 'api' },
      { id: 'response', source: 'api', target: 'web' },
    ] as Edge[];
    loadGraph(nodes, edges);
    const { result } = renderHook(() => useHandleSlotLayout('web'));
    const request = computeEdgeRoute(edges[0], nodes, edges);
    const response = computeEdgeRoute(edges[1], nodes, edges);
    expect(request.sourcePosition).toBe(Position.Right);
    expect(response.targetPosition).toBe(Position.Right);
    expect(result.current.shouldRenderHandle(Position.Right, 'source')).toBe(true);
    expect(result.current.shouldRenderHandle(Position.Right, 'target')).toBe(true);
    expect(result.current.getSlotOffset(Position.Right, 'source')).not.toBe(result.current.getSlotOffset(Position.Right, 'target'));
    const webCenterY = nodes[0].position.y + (nodes[0].height ?? 0) / 2;
    expect(request.sourcePoint.y - webCenterY).toBe(result.current.getSlotOffset(Position.Right, 'source'));
    expect(response.targetPoint.y - webCenterY).toBe(result.current.getSlotOffset(Position.Right, 'target'));
  });

  it('shows the source and target of a self-loop on their actual sides', () => {
    const nodes = [node('api', 0)];
    const edges = [{ id: 'loop', source: 'api', target: 'api' }] as Edge[];
    loadGraph(nodes, edges);
    const { result } = renderHook(() => useHandleSlotLayout('api'));
    expect(result.current.shouldRenderHandle(Position.Left, 'source')).toBe(true);
    expect(result.current.shouldRenderHandle(Position.Right, 'target')).toBe(true);
    expect(result.current.shouldRenderHandle(Position.Right, 'source')).toBe(false);
  });
});
