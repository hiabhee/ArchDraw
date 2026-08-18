import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';

describe('duplicateNode', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      past: [],
      future: [],
      canvases: [
        {
          id: 'dup-canvas',
          name: 'Dup',
          nodes: [],
          edges: [],
          isOpen: true,
          updatedAt: Date.now(),
        },
      ],
      activeCanvasId: 'dup-canvas',
      openCanvasIds: ['dup-canvas'],
    });
  });

  it('returns undefined for a missing node', () => {
    const id = useDiagramStore.getState().duplicateNode('missing');
    expect(id).toBeUndefined();
  });

  it('duplicates a system node with standard offset and label suffix', () => {
    useDiagramStore.getState().addNode('service', 'Order Service', undefined, undefined, undefined, undefined, { x: 100, y: 200 });

    const original = useDiagramStore.getState().nodes[0];
    const newId = useDiagramStore.getState().duplicateNode(original.id);

    expect(newId).toBeTruthy();
    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(2);

    const copy = nodes.find((n) => n.id === newId);
    expect(copy?.position.x).toBe(original.position.x + 30);
    expect(copy?.position.y).toBe(original.position.y + 30);
    expect(copy?.data.label).toBe('Order Service (copy)');

    const source = nodes.find((n) => n.id === original.id);
    expect(source?.data.label).toBe('Order Service');
  });

  it('preserves shape/system node metadata and drops transient fields', () => {
    const shapeNode = {
      id: 'shape-1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      width: 200,
      height: 96,
      selected: true,
      dragging: false,
      measured: { width: 200, height: 96 },
      data: {
        label: 'API Gateway',
        shape: 'hexagon',
        typeId: 'api-gateway',
        serviceType: 'load-balancer',
        accentColor: '#0f766e',
        nodeWidth: 200,
        nodeHeight: 96,
      },
    } as Node & { measured?: { width: number; height: number } };
    useDiagramStore.getState().importDiagram([shapeNode], []);

    const newId = useDiagramStore.getState().duplicateNode('shape-1');
    const copy = useDiagramStore.getState().nodes.find((n) => n.id === newId);

    expect(copy?.type).toBe('shapeNode');
    expect(copy?.data.shape).toBe('hexagon');
    expect(copy?.data.typeId).toBe('api-gateway');
    expect(copy?.data.serviceType).toBe('load-balancer');
    expect(copy?.data.accentColor).toBe('#0f766e');
    expect(copy?.data.nodeWidth).toBe(200);
    expect(copy?.width).toBe(200);
    expect(copy?.selected).toBe(false);
    expect((copy as unknown as { measured?: unknown }).measured).toBeUndefined();
    expect((copy as unknown as { dragging?: unknown }).dragging).toBeUndefined();
  });

  it('selects only the duplicated node', () => {
    useDiagramStore.getState().addNode('service', 'A', undefined, undefined, undefined, undefined, { x: 0, y: 0 });
    useDiagramStore.getState().addNode('service', 'B', undefined, undefined, undefined, undefined, { x: 0, y: 0 });
    const first = useDiagramStore.getState().nodes[0];

    const newId = useDiagramStore.getState().duplicateNode(first.id);
    expect(useDiagramStore.getState().selectedNodeIds).toEqual([newId]);
    expect(useDiagramStore.getState().selectedNodeId).toBe(newId);
  });

  it('supports custom offset and label suffix options', () => {
    useDiagramStore.getState().addNode('service', 'A', undefined, undefined, undefined, undefined, { x: 10, y: 20 });
    const original = useDiagramStore.getState().nodes[0];

    const newId = useDiagramStore.getState().duplicateNode(original.id, {
      offset: { x: 80, y: 40 },
      labelSuffix: ' v2',
    });

    const copy = useDiagramStore.getState().nodes.find((n) => n.id === newId);
    expect(copy?.position.x).toBe(90);
    expect(copy?.position.y).toBe(60);
    expect(copy?.data.label).toBe('A v2');
  });
});
