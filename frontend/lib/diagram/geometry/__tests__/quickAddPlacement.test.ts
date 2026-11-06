import { describe, expect, it } from 'vitest';
import { QUICK_ADD_GAP, placeQuickAddNode, type PlacementNode } from '../quickAddPlacement';

const SIZE = { width: 200, height: 100 };
const CENTRE = { x: 1000, y: 1000 };

const node = (id: string, x: number, y: number, extra: Partial<PlacementNode> = {}): PlacementNode => ({
  id,
  position: { x, y },
  width: 200,
  height: 100,
  ...extra,
});

const overlapsAny = (pos: { x: number; y: number }, nodes: PlacementNode[]) =>
  nodes.some((n) =>
    pos.x < n.position.x + 200 + 24 &&
    n.position.x < pos.x + SIZE.width + 24 &&
    pos.y < n.position.y + 100 + 24 &&
    n.position.y < pos.y + SIZE.height + 24,
  );

describe('placeQuickAddNode', () => {
  it('uses the viewport centre when nothing is selected or quick-added', () => {
    const result = placeQuickAddNode({
      nodes: [],
      edges: [],
      size: SIZE,
      selectedIds: [],
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.anchorId).toBeUndefined();
    expect(result.position).toEqual({ x: CENTRE.x - 100, y: CENTRE.y - 50 });
  });

  it('does not treat a group at the viewport centre as an obstacle', () => {
    // A big group sits under the viewport centre: the node is dropped there, not pushed outside it.
    const group = node('G', 500, 500, { type: 'groupNode', width: 1000, height: 1000, data: null });
    const result = placeQuickAddNode({
      nodes: [group],
      edges: [],
      size: SIZE,
      selectedIds: [],
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.position).toEqual({ x: CENTRE.x - 100, y: CENTRE.y - 50 });
  });

  it('places beside the selected node on the right when that side is free', () => {
    const a = node('a', 0, 0);
    const result = placeQuickAddNode({
      nodes: [a],
      edges: [],
      size: SIZE,
      selectedIds: ['a'],
      primaryId: 'a',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.anchorId).toBe('a');
    expect(result.side).toBe('right');
    expect(result.position).toEqual({ x: 200 + QUICK_ADD_GAP, y: 50 - 50 });
  });

  it('never lands on top of an existing node', () => {
    const nodes = [node('a', 0, 0), node('b', 280, 0), node('c', 0, 180), node('d', -280, 0), node('e', 0, -180)];
    const result = placeQuickAddNode({
      nodes,
      edges: [],
      size: SIZE,
      selectedIds: ['a'],
      primaryId: 'a',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.position).toBeDefined();
    expect(overlapsAny(result.position, nodes.filter((n) => n.id !== 'a'))).toBe(false);
  });

  it('stacks below the node the last quick-add went below', () => {
    // A above B; the user just placed B below A, so B is anchor and memory says "bottom".
    const a = node('a', 0, 0);
    const b = node('b', 0, 200);
    const result = placeQuickAddNode({
      nodes: [a, b],
      edges: [{ source: 'a', target: 'b' }],
      size: SIZE,
      selectedIds: ['b'],
      primaryId: 'b',
      viewportCenter: CENTRE,
      memory: { nodeId: 'b', side: 'bottom' },
    });
    expect(result.side).toBe('bottom');
    // The pair is spaced 100px apart (A bottom 100 → B top 200), so the next node keeps that rhythm.
    expect(result.position).toEqual({ x: 0, y: 200 + 100 + 100 });
  });

  it('continues past a node already sitting in the chosen direction', () => {
    // Selecting A with B already below it: the new node chains past B instead of overlapping it.
    const a = node('a', 0, 0);
    const b = node('b', 0, 200);
    const result = placeQuickAddNode({
      nodes: [a, b],
      edges: [],
      size: SIZE,
      selectedIds: ['a'],
      primaryId: 'a',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(overlapsAny(result.position, [a, b])).toBe(false);
  });

  it('continues a vertical line without any memory of the last quick-add', () => {
    // A and B were placed by hand, stacked; the user selects B and presses the shortcut.
    const a = node('a', 0, 0);
    const b = node('b', 0, 200);
    const result = placeQuickAddNode({
      nodes: [a, b],
      edges: [],
      size: SIZE,
      selectedIds: ['b'],
      primaryId: 'b',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.side).toBe('bottom');
    // The pair is spaced 100px apart (A bottom 100 → B top 200), so the next node keeps that rhythm.
    expect(result.position).toEqual({ x: 0, y: 200 + 100 + 100 });
  });

  it('goes past a stacked pair when the anchor is the first of the pair', () => {
    const a = node('a', 0, 0);
    const b = node('b', 0, 200);
    const result = placeQuickAddNode({
      nodes: [a, b],
      edges: [],
      size: SIZE,
      selectedIds: ['a'],
      primaryId: 'a',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.side).toBe('bottom');
    // The pair is spaced 100px apart (A bottom 100 → B top 200), so the next node keeps that rhythm.
    expect(result.position).toEqual({ x: 0, y: 200 + 100 + 100 });
  });

  it('copies the spacing of an in-line neighbour on the other side', () => {
    // B sits 100px to the left of A, so a node placed to the right of A keeps that 100px gap.
    const a = node('a', 0, 0);
    const b = node('b', -300, 0);
    const result = placeQuickAddNode({
      nodes: [a, b],
      edges: [],
      size: SIZE,
      selectedIds: ['a'],
      primaryId: 'a',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.side).toBe('right');
    expect(result.position).toEqual({ x: 200 + 100, y: 0 });
  });

  it('keeps a node inside its group when the anchor is a child', () => {
    const group = node('G', 0, 0, { width: 600, height: 400, data: null });
    const child = node('c', 300, 100, { parentNode: 'G' });
    // Right would leave the group, so the node should go below the child, inside the group.
    const result = placeQuickAddNode({
      nodes: [group, child],
      edges: [],
      size: SIZE,
      selectedIds: ['c'],
      primaryId: 'c',
      viewportCenter: CENTRE,
      memory: null,
    });
    expect(result.parentNode).toBe('G');
    expect(result.side).toBe('bottom');
    expect(result.position).toEqual({ x: 300, y: 100 + 100 + QUICK_ADD_GAP });
  });
});
