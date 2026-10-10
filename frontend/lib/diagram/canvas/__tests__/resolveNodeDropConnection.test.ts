import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { resolveNodeDropConnection } from '../resolveNodeDropConnection';

function makeNode(
  id: string,
  x: number,
  y: number,
  width = 200,
  height = 80,
): Node {
  return {
    id,
    position: { x, y },
    data: {},
    width,
    height,
  };
}

describe('resolveNodeDropConnection', () => {
  it('connects source drag to the facing target handle on another node', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 300, 0)];

    const connection = resolveNodeDropConnection({
      nodes,
      originNodeId: 'a',
      originHandleType: 'source',
      originHandleId: 'source-right',
      targetNodeId: 'b',
    });

    expect(connection).toEqual({
      source: 'a',
      sourceHandle: 'source-right',
      target: 'b',
      targetHandle: 'target-left',
    });
  });

  it('connects target drag using the facing source handle on the drop node', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 0, 200)];

    const connection = resolveNodeDropConnection({
      nodes,
      originNodeId: 'a',
      originHandleType: 'target',
      originHandleId: 'target-bottom',
      targetNodeId: 'b',
    });

    expect(connection).toEqual({
      source: 'b',
      sourceHandle: 'source-top',
      target: 'a',
      targetHandle: 'target-bottom',
    });
  });

  it('returns null for self-drops', () => {
    const nodes = [makeNode('a', 0, 0)];

    expect(
      resolveNodeDropConnection({
        nodes,
        originNodeId: 'a',
        originHandleType: 'source',
        originHandleId: 'source-right',
        targetNodeId: 'a',
      }),
    ).toBeNull();
  });
});
