import { describe, expect, it } from 'vitest';
import { foreignNodeIds } from '../layout/groupDirections';
import { symmetrizeFans } from '../layout/symmetry';
import type { LayoutNode, LayoutParams, LayoutResult, RankDirection } from '../layout/LayoutEngine';

const node = (id: string, extra: Partial<LayoutNode> = {}): LayoutNode => ({ id, width: 200, height: 64, ...extra });
const params = (nodes: LayoutNode[], direction: RankDirection = 'LR', edges: Array<[string, string]> = []): LayoutParams => ({
  nodes,
  edges: edges.map(([source, target], i) => ({ id: `e${i}`, source, target })),
  direction,
});

describe('foreignNodeIds', () => {
  it('finds the nodes inside a group laid out the other way', () => {
    const p = params([
      node('g1', { isGroup: true, direction: 'TB' }),
      node('g2', { isGroup: true }),
      node('a', { parentId: 'g1' }),
      node('b', { parentId: 'g2' }),
      node('c'),
    ]);
    expect([...foreignNodeIds(p)]).toEqual(['a']);
  });

  it('treats the same axis as the same direction (RL in an LR diagram, BT in a TB one)', () => {
    const lr = params([node('g', { isGroup: true, direction: 'RL' }), node('a', { parentId: 'g' })], 'LR');
    expect(foreignNodeIds(lr).size).toBe(0);
    const tb = params([node('g', { isGroup: true, direction: 'BT' }), node('a', { parentId: 'g' })], 'TB');
    expect(foreignNodeIds(tb).size).toBe(0);
  });

  it('lets the nearest group with a direction of its own decide, at any depth', () => {
    const p = params([
      node('outer', { isGroup: true, direction: 'TB' }),
      node('inner', { isGroup: true, parentId: 'outer' }),
      node('deep', { parentId: 'inner' }),
      node('back', { isGroup: true, parentId: 'outer', direction: 'LR' }),
      node('home', { parentId: 'back' }),
    ]);
    // `back` sits in outer's top-down space, so it is foreign; `home`, inside back's own left-to-right group, is not.
    expect([...foreignNodeIds(p)].sort()).toEqual(['back', 'deep', 'inner']);
  });

  it('is empty when no group has a direction, and survives a parent cycle', () => {
    expect(foreignNodeIds(params([node('g', { isGroup: true }), node('a', { parentId: 'g' })])).size).toBe(0);
    const cyc = params([node('a', { isGroup: true, direction: 'TB', parentId: 'b' }), node('b', { isGroup: true, parentId: 'a' })]);
    expect(() => foreignNodeIds(cyc)).not.toThrow();
  });
});

describe('symmetrizeFans with a group laid out the other way', () => {
  /** A parent with three branches, lopsided: centring it would move it. */
  function fan(groupDirection?: RankDirection): { p: LayoutParams; result: LayoutResult } {
    const nodes = [
      node('g', { isGroup: true, width: 600, height: 700, ...(groupDirection ? { direction: groupDirection } : {}) }),
      node('parent', { parentId: 'g' }),
      node('x', { parentId: 'g' }),
      node('y', { parentId: 'g' }),
      node('z', { parentId: 'g' }),
    ];
    const at: Record<string, [number, number]> = { g: [380, 0], parent: [400, 0], x: [700, 0], y: [700, 200], z: [700, 400] };
    return {
      p: params(nodes, 'LR', [['parent', 'x'], ['parent', 'y'], ['parent', 'z']]),
      result: { nodes: nodes.map(n => ({ ...n, x: at[n.id][0], y: at[n.id][1] })), edges: [], warnings: [] },
    };
  }
  const yOf = (result: LayoutResult, id: string) => result.nodes.find(n => n.id === id)!.y;

  it('centres the fan in a group that runs the diagram\'s way (control)', () => {
    const { p, result } = fan();
    const next = symmetrizeFans(result, p);
    expect(yOf(next, 'parent')).not.toBe(0);
  });

  it('leaves every node of a group that runs the other way where the layout put it', () => {
    const { p, result } = fan('TB');
    const next = symmetrizeFans(result, p);
    for (const id of ['parent', 'x', 'y', 'z']) expect(yOf(next, id)).toBe(yOf(result, id));
  });
});
