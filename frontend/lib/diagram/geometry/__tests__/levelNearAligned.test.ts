import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { levelNearAlignedNodes } from '../levelNearAligned';

const node = (id: string, x: number, y: number, width: number, height: number, extra: Partial<Node> = {}): Node => ({
  id, type: 'systemNode', position: { x, y }, width, height, data: {}, ...extra,
});
const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

function apply(nodes: Node[], moves: Map<string, { x: number; y: number }>): Node[] {
  return nodes.map(n => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n));
}
const centreY = (n: Node) => n.position.y + (n.height ?? 0) / 2;

describe('levelNearAlignedNodes', () => {
  it('levels two nodes lined up by their tops whose cards render at different heights', () => {
    // DNS wraps its subtitle (105px), CDN does not (88px): centres 92.5 vs 84.
    const nodes = [node('dns', 0, 40, 260, 105), node('cdn', 420, 40, 260, 88)];
    const moves = levelNearAlignedNodes(nodes, [edge('dns', 'cdn')], 'LR');
    const after = apply(nodes, moves);
    expect(centreY(after[0])).toBeCloseTo(centreY(after[1]), 5);
    expect(moves.size).toBe(1);
  });

  it('works top-down too', () => {
    const nodes = [node('a', 40, 0, 200, 100), node('b', 52, 300, 180, 100)];
    const moves = levelNearAlignedNodes(nodes, [edge('a', 'b')], 'TD');
    const after = apply(nodes, moves);
    expect(after[0].position.x + 100).toBeCloseTo(after[1].position.x + 90, 5);
  });

  it('leaves a deliberate offset alone', () => {
    const nodes = [node('a', 0, 0, 200, 100), node('b', 400, 40, 200, 100)];
    expect(levelNearAlignedNodes(nodes, [edge('a', 'b')], 'LR').size).toBe(0);
  });

  it('leaves an edge that is already level alone', () => {
    const nodes = [node('a', 0, 0, 200, 100), node('b', 400, 0, 200, 100)];
    expect(levelNearAlignedNodes(nodes, [edge('a', 'b')], 'LR').size).toBe(0);
  });

  it('does not move a node if that bends an edge that is already level', () => {
    // b is level with c and 6px off a: levelling b with a would bend b -> c.
    const nodes = [node('a', 0, 6, 200, 100), node('b', 400, 0, 200, 100), node('c', 800, 0, 200, 100)];
    const moves = levelNearAlignedNodes(nodes, [edge('a', 'b'), edge('b', 'c')], 'LR');
    const after = apply(nodes, moves);
    expect(centreY(after[1])).toBeCloseTo(centreY(after[2]), 5);
  });

  it('never moves a node into another node', () => {
    // Levelling b with a would move it 6px up, to within 4px of the blocker above it.
    const nodes = [node('a', 0, 100, 200, 100), node('b', 400, 106, 200, 100), node('blocker', 400, -4, 200, 100)];
    const moves = levelNearAlignedNodes(nodes, [edge('a', 'b')], 'LR');
    expect(moves.has('b')).toBe(false);
  });

  it('keeps a node inside its group', () => {
    const group = node('g', 0, 0, 700, 140, { type: 'groupNode' });
    const nodes = [
      group,
      node('a', 20, 20, 200, 100, { parentNode: 'g' }),
      node('b', 450, 34, 200, 100, { parentNode: 'g' }),
    ];
    // b is 14px low already at the frame's bottom (34 + 100 = 134 of 140): levelling up is fine, down is not.
    const moves = levelNearAlignedNodes(nodes, [edge('a', 'b')], 'LR');
    for (const [, at] of moves) {
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y + 100).toBeLessThanOrEqual(140);
    }
  });

  it('ignores edges between different groups and edges that touch a group node', () => {
    const nodes = [
      node('g1', 0, 0, 300, 200, { type: 'groupNode' }),
      node('g2', 500, 0, 300, 200, { type: 'groupNode' }),
      node('a', 10, 10, 200, 100, { parentNode: 'g1' }),
      node('b', 10, 16, 200, 100, { parentNode: 'g2' }),
    ];
    expect(levelNearAlignedNodes(nodes, [edge('a', 'b'), edge('g1', 'g2')], 'LR').size).toBe(0);
  });

  it('is idempotent: the result needs no further levelling', () => {
    const nodes = [node('a', 0, 40, 260, 105), node('b', 420, 40, 260, 88), node('c', 840, 46, 260, 100)];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const first = apply(nodes, levelNearAlignedNodes(nodes, edges, 'LR'));
    expect(levelNearAlignedNodes(first, edges, 'LR').size).toBe(0);
  });

  it('does not treat stacked nodes as side by side', () => {
    const nodes = [node('a', 0, 0, 200, 100), node('b', 6, 160, 200, 100)];
    expect(levelNearAlignedNodes(nodes, [edge('a', 'b')], 'LR').size).toBe(0);
  });
});
