import { describe, expect, it } from 'vitest';
import { movesWithDrag } from '../dragAttachment';

type N = { dragging?: boolean; parentNode?: string; parentId?: string };
const lookup = (nodes: Record<string, N>) => (id: string) => nodes[id];

describe('movesWithDrag', () => {
  it('is true for the node being dragged', () => {
    expect(movesWithDrag(lookup({ a: { dragging: true } }), 'a')).toBe(true);
  });

  it('is false for a node that is neither dragged nor inside a dragged group', () => {
    expect(movesWithDrag(lookup({ a: { dragging: true }, b: {} }), 'b')).toBe(false);
  });

  it('is true for a node inside the group being dragged', () => {
    const nodes = { g: { dragging: true }, child: { parentNode: 'g' } };
    expect(movesWithDrag(lookup(nodes), 'child')).toBe(true);
  });

  it('is true at any depth, and for either parent field', () => {
    const nodes = { g: { dragging: true }, inner: { parentId: 'g' }, leaf: { parentNode: 'inner' } };
    expect(movesWithDrag(lookup(nodes), 'leaf')).toBe(true);
  });

  it('is false for a node inside a group that is not being dragged', () => {
    const nodes = { g: {}, child: { parentNode: 'g' }, other: { dragging: true } };
    expect(movesWithDrag(lookup(nodes), 'child')).toBe(false);
  });

  it('is false for an unknown node and survives a parent cycle', () => {
    expect(movesWithDrag(lookup({}), 'missing')).toBe(false);
    const cycle = { a: { parentNode: 'b' }, b: { parentNode: 'a' } };
    expect(movesWithDrag(lookup(cycle), 'a')).toBe(false);
  });
});
