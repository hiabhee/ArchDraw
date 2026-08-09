import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { scoreDiagram } from '../scoreDiagram';

const node = (id: string, type = 'systemNode'): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id },
});

const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe('scoreDiagram text-node tolerance', () => {
  it('does not count text nodes as orphans', () => {
    const nodes: Node[] = [node('api'), node('db'), node('title', 'textLabelNode'), node('note', 'annotationNode')];
    const edges: Edge[] = [edge('e1', 'api', 'db')];
    const report = scoreDiagram(nodes, edges, { detailLevel: 2, diagramSize: 'medium' });
    expect(report.orphanCount).toBe(0);
  });

  it('excludes text nodes from the node-count sizing', () => {
    const nodes: Node[] = [
      node('a'), node('b'), node('c'),
      node('title', 'textLabelNode'), node('note', 'annotationNode'),
    ];
    const edges: Edge[] = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    const report = scoreDiagram(nodes, edges, { detailLevel: 1, diagramSize: 'small' });
    expect(report.nodeCount).toBe(3);
  });
});
