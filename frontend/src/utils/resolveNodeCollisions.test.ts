import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { resolveNodeCollisions } from './resolveNodeCollisions';

function node(id: string, x: number, y = 0, width = 100, height = 80): Node {
  return {
    id,
    type: 'systemNode',
    position: { x, y },
    width,
    height,
    data: {},
  } as Node;
}

describe('resolveNodeCollisions', () => {
  it('does not add spacing between separate diagrams', () => {
    const nodes = [node('a', 0), node('b', 100)];
    const resolved = resolveNodeCollisions(nodes);

    expect(resolved.map((n) => n.position.x)).toEqual([0, 100]);
  });

  it('still separates nodes that genuinely overlap', () => {
    const resolved = resolveNodeCollisions([node('a', 0), node('b', 80)]);

    expect(resolved[0].position.x).toBe(-10);
    expect(resolved[1].position.x).toBe(90);
  });
});
