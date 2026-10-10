import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  createDiagramTitleNode,
  ensureDiagramHeading,
  findDiagramTitleNode,
  DIAGRAM_TITLE_ID,
} from '../diagramHeading';

function shapeNode(id: string, label: string): Node {
  return {
    id,
    type: 'shapeNode',
    position: { x: 0, y: 0 },
    width: 200,
    height: 80,
    data: { label, shape: 'rectangle' },
  };
}

describe('diagramHeading', () => {
  it('creates a top-anchored heading node', () => {
    const title = createDiagramTitleNode('Netflix Architecture');
    expect(title.id).toBe(DIAGRAM_TITLE_ID);
    expect(title.type).toBe('textLabelNode');
    expect(title.data).toMatchObject({
      text: 'Netflix Architecture',
      fontSize: 'heading',
      anchor: 'top',
    });
    expect(title.width).toBeGreaterThan(0);
    expect(title.height).toBeGreaterThan(0);
  });

  it('does not add a heading when the graph has no title (opt-in only)', () => {
    const nodes = [shapeNode('api', 'API'), shapeNode('db', 'DB')];
    const result = ensureDiagramHeading(nodes, 'Payments Flow');

    expect(result).toHaveLength(2);
    expect(findDiagramTitleNode(result)).toBeUndefined();
  });

  it('preserves an existing top heading and enforces anchor top', () => {
    const nodes: Node[] = [
      {
        id: 'title',
        type: 'textLabelNode',
        position: { x: 10, y: 5 },
        data: { text: 'Kafka', fontSize: 'heading', anchor: 'none' },
      },
      shapeNode('broker', 'Broker'),
    ];

    const result = ensureDiagramHeading(nodes, 'Ignored');
    const title = findDiagramTitleNode(result)!;
    expect(title.data).toMatchObject({ text: 'Kafka', anchor: 'top', fontSize: 'heading' });
  });

  it('does not add a heading to an empty graph', () => {
    expect(ensureDiagramHeading([], 'Title')).toEqual([]);
  });
});
