import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { archdrawNodes, archdrawEdges } from '@/data/templates/archdraw';
import { layoutDiagramViaMermaid } from './relayout';

function group(id: string, label: string, parent?: string): Node {
  return {
    id,
    type: 'groupNode',
    position: { x: 0, y: 0 },
    parentNode: parent,
    data: { label, isGroup: true },
  } as Node;
}

function node(id: string, label: string, parent?: string): Node {
  const n: Node = {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    data: { label },
  } as Node;
  if (parent) n.parentNode = parent;
  return n;
}

describe('layoutDiagramViaMermaid', () => {
  it('sizes an outer group to contain nested group children (LR)', async () => {
    const nodes: Node[] = [
      group('kafka', 'Kafka'),
      group('broker1', 'Broker1', 'kafka'),
      group('broker2', 'Broker2', 'kafka'),
      node('p0', 'Partition 0', 'broker1'),
      node('p1', 'Partition 1', 'broker2'),
    ];
    const edges: Edge[] = [
      { id: 'e0', source: 'p0', target: 'p1' } as Edge,
    ];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');

    expect(result.success).toBe(true);
    expect(result.nodes.length).toBeGreaterThanOrEqual(5);

    const kafka = result.nodes.find((n) => n.id === 'kafka')!;
    const broker1 = result.nodes.find((n) => n.id === 'broker1')!;
    const broker2 = result.nodes.find((n) => n.id === 'broker2')!;

    const broker1Right = broker1.position.x + (broker1.width ?? 0);
    const broker2Bottom = broker2.position.y + (broker2.height ?? 0);
    expect(kafka.width).toBeGreaterThan(broker1Right);
    expect(kafka.height).toBeGreaterThan(broker2Bottom);

    expect(broker1.parentNode).toBe('kafka');
    expect(broker2.parentNode).toBe('kafka');
  });

  it('relays leaf nodes within a group (1-level nesting)', async () => {
    const nodes: Node[] = [
      group('app', 'App'),
      node('api', 'API', 'app'),
      node('db', 'DB', 'app'),
      node('web', 'Web'),
    ];
    const edges: Edge[] = [
      { id: 'e0', source: 'web', target: 'api' } as Edge,
      { id: 'e1', source: 'api', target: 'db' } as Edge,
    ];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'TD');

    expect(result.success).toBe(true);
    const app = result.nodes.find((n) => n.id === 'app')!;
    const api = result.nodes.find((n) => n.id === 'api')!;
    expect(app.width).toBeGreaterThan(0);
    expect(api.parentNode).toBe('app');
  });

  it('returns the input unchanged when the pipeline rejects the graph', async () => {
    const nodes: Node[] = [
      { id: 'bad', type: 'groupNode', position: { x: 0, y: 0 }, data: { label: '' } } as Node,
    ];
    const result = await layoutDiagramViaMermaid(nodes, [], 'LR');
    expect(result.success).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('layouts the ArchDraw template (same path as template load + toggler)', async () => {
    const result = await layoutDiagramViaMermaid(archdrawNodes, archdrawEdges, 'LR');
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(archdrawNodes.length);
    expect(result.nodes.some((n) => n.id === 'title' && n.type === 'textLabelNode')).toBe(false);

    let moved = 0;
    for (const n of result.nodes) {
      const orig = archdrawNodes.find((o) => o.id === n.id);
      if (!orig) continue;
      if (orig.position.x !== n.position.x || orig.position.y !== n.position.y) moved++;
    }
    expect(moved).toBeGreaterThan(0);

    for (const orig of archdrawNodes) {
      if (!orig.parentNode) continue;
      const laid = result.nodes.find((n) => n.id === orig.id);
      expect(laid?.parentNode).toBe(orig.parentNode);
    }
  });

  it('does not auto-add a heading when toggling LR/TD (opt-in only)', async () => {
    const nodes: Node[] = [
      node('checkout', 'Checkout API'),
      node('pay', 'Payment Service'),
      node('orders', 'Order Store'),
    ];
    const edges: Edge[] = [
      { id: 'e0', source: 'checkout', target: 'pay' } as Edge,
      { id: 'e1', source: 'checkout', target: 'orders' } as Edge,
    ];

    const lr = await layoutDiagramViaMermaid(nodes, edges, 'LR', { title: 'Order Checkout' });
    expect(lr.success).toBe(true);
    expect(lr.nodes.find((n) => n.id === 'title')).toBeUndefined();

    // When a heading is explicitly provided, it is preserved and kept above the graph
    const withTitle: Node[] = [
      {
        id: 'title',
        type: 'textLabelNode',
        position: { x: 0, y: 0 },
        data: { text: 'Order Checkout', fontSize: 'heading', anchor: 'top' },
      } as Node,
      ...nodes,
    ];
    const lrWithTitle = await layoutDiagramViaMermaid(withTitle, edges, 'LR');
    expect(lrWithTitle.success).toBe(true);
    const titleLR = lrWithTitle.nodes.find((n) => n.id === 'title')!;
    expect(titleLR.type).toBe('textLabelNode');
    expect((titleLR.data as { text?: string }).text).toBe('Order Checkout');

    const td = await layoutDiagramViaMermaid(lrWithTitle.nodes, lrWithTitle.edges, 'TD');
    expect(td.success).toBe(true);
    const titleTD = td.nodes.find((n) => n.id === 'title')!;
    const checkoutTD = td.nodes.find((n) => n.id === 'checkout')!;
    expect((titleTD.data as { anchor?: string }).anchor).toBe('top');
    expect(titleTD.position.y + (titleTD.height ?? 0)).toBeLessThan(checkoutTD.position.y);
  });

  it('keeps a top heading through the LR/TB relayout round-trip', async () => {
    const nodes: Node[] = [
      {
        id: 'title',
        type: 'textLabelNode',
        position: { x: 0, y: 0 },
        data: { text: 'Order Checkout', fontSize: 'heading', anchor: 'top' },
      } as Node,
      node('checkout', 'Checkout API'),
      node('pay', 'Payment Service'),
      node('orders', 'Order Store'),
    ];
    const edges: Edge[] = [
      { id: 'e0', source: 'checkout', target: 'pay' } as Edge,
      { id: 'e1', source: 'checkout', target: 'orders' } as Edge,
    ];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'TD');

    expect(result.success).toBe(true);
    const title = result.nodes.find((n) => n.id === 'title')!;
    expect(title.type).toBe('textLabelNode');
    expect((title.data as { text?: string }).text).toBe('Order Checkout');
    // Heading rides above the graph content in the flow direction
    const checkout = result.nodes.find((n) => n.id === 'checkout')!;
    expect(title.position.y + (title.height ?? 0)).toBeLessThan(checkout.position.y);
  });

  it('keeps anchor none free-text at its stored position through relayout', async () => {
    const nodes: Node[] = [
      {
        id: 'free',
        type: 'textLabelNode',
        position: { x: 320, y: 210 },
        data: { text: 'freeform note', anchor: 'none' },
      } as Node,
      node('api', 'API'),
      node('db', 'DB'),
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'api', target: 'db' } as Edge];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');

    expect(result.success).toBe(true);
    const free = result.nodes.find((n) => n.id === 'free')!;
    expect(free.type).toBe('textLabelNode');
    expect(free.position.x).toBe(320);
    expect(free.position.y).toBe(210);
  });

  it('keeps an annotation node with its title/body through relayout', async () => {
    const nodes: Node[] = [
      {
        id: 'note1',
        type: 'annotationNode',
        position: { x: 0, y: 0 },
        data: { title: 'Async', body: 'via queue', anchor: 'node', anchorTarget: 'api' },
      } as Node,
      node('api', 'API'),
      node('db', 'DB'),
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'api', target: 'db' } as Edge];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');

    expect(result.success).toBe(true);
    const note = result.nodes.find((n) => n.id === 'note1')!;
    expect(note.type).toBe('annotationNode');
    expect((note.data as { title?: string }).title).toBe('Async');
    expect((note.data as { body?: string }).body).toBe('via queue');
    const api = result.nodes.find((n) => n.id === 'api')!;
    expect(note.position.x).toBeGreaterThan(api.position.x + (api.width ?? 0));
  });

  it('preserves horizontal pipe height after relayout (not vertical drum height)', async () => {
    const nodes: Node[] = [
      {
        id: 'broker',
        type: 'shapeNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'Brokerage API',
          sublabel: 'Connector',
          shape: 'cylinder',
          serviceType: 'queue',
          cylinderAxis: 'horizontal',
          nodeWidth: 240,
          nodeHeight: 112,
        },
        width: 240,
        height: 112,
      } as Node,
    ];
    const edges: Edge[] = [];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');

    expect(result.success).toBe(true);
    const broker = result.nodes.find((n) => n.id === 'broker')!;
    expect(broker.height).toBeLessThanOrEqual(120);
    expect(broker.height).toBeGreaterThanOrEqual(100);
    expect((broker.data as { nodeHeight?: number }).nodeHeight).toBe(broker.height);
  });
});
