import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { nodeSize, nodeCentre, NODE_FALLBACK_WIDTH, NODE_FALLBACK_HEIGHT } from '../nodeBox';
import { computeAlignmentGuides } from '../alignmentGuides';

const node = (id: string, x: number, y: number, extra: Partial<Node> = {}): Node =>
  ({ id, type: 'systemNode', position: { x, y }, data: {}, ...extra }) as Node;

describe('nodeSize', () => {
  it('prefers the measured size over the stored one', () => {
    expect(nodeSize({ width: 240, height: 120, data: { nodeWidth: 200, nodeHeight: 100 } })).toEqual({ width: 240, height: 120 });
  });

  it('falls back to the size stored in data, then the style, then the shared default', () => {
    expect(nodeSize({ data: { nodeWidth: 160, nodeHeight: 88 } })).toEqual({ width: 160, height: 88 });
    expect(nodeSize({ style: { width: 180, height: 90 } })).toEqual({ width: 180, height: 90 });
    expect(nodeSize({})).toEqual({ width: NODE_FALLBACK_WIDTH, height: NODE_FALLBACK_HEIGHT });
  });
});

describe('nodeCentre', () => {
  it('uses the absolute corner for nodes inside a group', () => {
    const child = node('c', 10, 10, { positionAbsolute: { x: 300, y: 200 }, width: 200, height: 100 });
    expect(nodeCentre(child)).toEqual({ x: 400, y: 250 });
  });
});

describe('alignment snap with different node heights', () => {
  it('lines up centres exactly, so an edge between them is level', () => {
    // A is 100px tall (centre y 50); B is 120px tall and dragged slightly high (centre y 40).
    const a = node('a', 0, 0, { width: 200, height: 100 });
    const b = node('b', 400, -20, { width: 200, height: 120 });
    const edges: Edge[] = [{ id: 'e', source: 'a', target: 'b' }];
    const { snapY } = computeAlignmentGuides(b, [a], 8, edges, new Set(['b']));
    expect(snapY).not.toBeNull();
    const snapped = { ...b, position: { x: b.position.x, y: b.position.y + (snapY ?? 0) } };
    expect(nodeCentre(snapped).y).toBe(nodeCentre(a).y);
  });
});

describe('alignment snap on the x axis', () => {
  const a = node('a', 0, 0, { width: 200, height: 100 });
  const edges: Edge[] = [{ id: 'e', source: 'a', target: 'b' }];

  it('lines up centres of a vertical pair with different widths', () => {
    // A centre x is 100; B is 120 wide at x=30, so its centre x is 90.
    const b = node('b', 30, 200, { width: 120, height: 100 });
    const { snapX } = computeAlignmentGuides(b, [a], 8, edges, new Set(['b']));
    expect(snapX).toBe(10);
  });

  it('does not snap a connected node by its left edge, which would leave the centres apart', () => {
    // B's left edge is 3px from A's, but the centres are 37px apart: no snap.
    const b = node('b', 3, 200, { width: 120, height: 100 });
    const { snapX } = computeAlignmentGuides(b, [a], 8, edges, new Set(['b']));
    expect(snapX).toBeNull();
  });
});
