import { describe, it, expect } from 'vitest';
import { recomputeSubgraphBounds, type SubgraphBoundsNode } from './recomputeSubgraphBounds';

function node(partial: Partial<SubgraphBoundsNode> & { id: string }): SubgraphBoundsNode {
  return {
    position: { x: 0, y: 0 },
    width: 180,
    height: 110,
    absX: 0,
    absY: 0,
    isGroup: false,
    ...partial,
  };
}

function absBounds(n: SubgraphBoundsNode): { x: number; y: number; right: number; bottom: number } {
  return { x: n.absX, y: n.absY, right: n.absX + n.width, bottom: n.absY + n.height };
}

function contains(parent: SubgraphBoundsNode, child: SubgraphBoundsNode): boolean {
  const p = absBounds(parent);
  const c = absBounds(child);
  return c.x >= p.x && c.y >= p.y && c.right <= p.right && c.bottom <= p.bottom;
}

describe('recomputeSubgraphBounds', () => {
  it('wraps an outer group around its nested group children (Kafka example)', () => {
    const nodes: SubgraphBoundsNode[] = [
      // Kafka cluster (outer group)
      node({ id: 'Kafka', isGroup: true, absX: 320, absY: -14, width: 640, height: 1081.5 }),
      // Three broker groups nested inside Kafka
      node({ id: 'Broker1', isGroup: true, parentNode: 'Kafka', absX: 640, absY: 50, width: 280, height: 290 }),
      node({ id: 'Broker2', isGroup: true, parentNode: 'Kafka', absX: 640, absY: 670, width: 280, height: 357.5 }),
      node({ id: 'Broker3', isGroup: true, parentNode: 'Kafka', absX: 640, absY: 360, width: 280, height: 290 }),
      // Topic (leaf child of Kafka)
      node({ id: 'Topic', parentNode: 'Kafka', absX: 360, absY: 430, width: 180, height: 110 }),
      // Partition nodes (leaf children of brokers)
      node({ id: 'P0', parentNode: 'Broker1', absX: 680, absY: 114, width: 180, height: 120 }),
      node({ id: 'P1', parentNode: 'Broker2', absX: 680, absY: 734, width: 180, height: 120 }),
      node({ id: 'P2', parentNode: 'Broker3', absX: 680, absY: 424, width: 180, height: 120 }),
    ];

    recomputeSubgraphBounds(nodes);

    const kafka = nodes.find(n => n.id === 'Kafka')!;
    const b1 = nodes.find(n => n.id === 'Broker1')!;
    const b2 = nodes.find(n => n.id === 'Broker2')!;
    const b3 = nodes.find(n => n.id === 'Broker3')!;
    const topic = nodes.find(n => n.id === 'Topic')!;
    const p0 = nodes.find(n => n.id === 'P0')!;

    // Outer group must be big enough to contain ALL its children (leaf + groups)
    expect(contains(kafka, topic)).toBe(true);
    expect(contains(kafka, b1)).toBe(true);
    expect(contains(kafka, b2)).toBe(true);
    expect(contains(kafka, b3)).toBe(true);
    expect(contains(b1, p0)).toBe(true);

    // Children are re-positioned relative to their (possibly moved) parent
    const kafkaNode = kafka;
    expect(b1.position.x).toBeCloseTo(b1.absX - kafkaNode.position.x, 5);
    expect(b1.position.y).toBeCloseTo(b1.absY - kafkaNode.position.y, 5);
    expect(topic.position.x).toBeCloseTo(topic.absX - kafkaNode.position.x, 5);
  });

  it('handles a single-level subgraph with leaf children', () => {
    const nodes: SubgraphBoundsNode[] = [
      node({ id: 'G', isGroup: true, absX: 100, absY: 100, width: 300, height: 300 }),
      node({ id: 'A', parentNode: 'G', absX: 120, absY: 130, width: 180, height: 110 }),
      node({ id: 'B', parentNode: 'G', absX: 360, absY: 130, width: 180, height: 110 }),
    ];

    recomputeSubgraphBounds(nodes);

    const g = nodes.find(n => n.id === 'G')!;
    const a = nodes.find(n => n.id === 'A')!;
    const b = nodes.find(n => n.id === 'B')!;
    expect(contains(g, a)).toBe(true);
    expect(contains(g, b)).toBe(true);
    expect(g.width).toBe(476);
    expect(g.height).toBe(186);
    expect(a.position.x).toBeCloseTo(28, 5);
  });

  it('leaves groups without children untouched', () => {
    const nodes: SubgraphBoundsNode[] = [
      node({ id: 'Empty', isGroup: true, position: { x: 50, y: 60 }, absX: 50, absY: 60, width: 200, height: 120 }),
      node({ id: 'X', absX: 10, absY: 10, width: 180, height: 110 }),
    ];

    recomputeSubgraphBounds(nodes);

    const empty = nodes.find(n => n.id === 'Empty')!;
    expect(empty.width).toBe(200);
    expect(empty.height).toBe(120);
    expect(empty.absX).toBe(50);
    expect(empty.absY).toBe(60);
  });
});
