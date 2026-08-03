import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { archdrawNodes, archdrawEdges } from '@/data/templates/archdraw';
import { layoutDiagramViaMermaid, relayoutCanvasViaMermaid } from './relayout';

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

describe('relayoutCanvasViaMermaid', () => {
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

    const result = await relayoutCanvasViaMermaid(nodes, edges, 'LR');

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

    const result = await relayoutCanvasViaMermaid(nodes, edges, 'TD');

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
    const result = await relayoutCanvasViaMermaid(nodes, [], 'LR');
    expect(result.success).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('layouts the ArchDraw template (same path as template load + toggler)', async () => {
    const result = await layoutDiagramViaMermaid(archdrawNodes, archdrawEdges, 'LR');
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(archdrawNodes.length);

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
});
