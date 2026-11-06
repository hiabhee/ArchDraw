import { describe, expect, it } from 'vitest';
import type { Node, NodeChange } from 'reactflow';
import { dropNoopDimensionChanges } from '../graphSlice';

const node = (id: string, width?: number, height?: number) =>
  ({ id, position: { x: 0, y: 0 }, data: {}, width, height }) as Node;

describe('dropNoopDimensionChanges', () => {
  const nodes = [node('a', 200, 100), node('b')];

  it('drops size reports equal to the stored size', () => {
    const changes: NodeChange[] = [{ id: 'a', type: 'dimensions', dimensions: { width: 200.2, height: 100 } }];
    expect(dropNoopDimensionChanges(changes, nodes)).toEqual([]);
  });

  it('keeps real size changes, unmeasured nodes, user resizes and other changes', () => {
    const changes: NodeChange[] = [
      { id: 'a', type: 'dimensions', dimensions: { width: 240, height: 100 } },
      { id: 'b', type: 'dimensions', dimensions: { width: 160, height: 100 } },
      { id: 'a', type: 'dimensions', dimensions: { width: 200, height: 100 }, resizing: true },
      { id: 'a', type: 'select', selected: true },
    ];
    expect(dropNoopDimensionChanges(changes, nodes)).toEqual(changes);
  });
});
