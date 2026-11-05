import { describe, expect, it } from 'vitest';
import { symmetrizeFans } from '../layout/symmetry';
import type { LayoutParams, LayoutResult } from '../layout/LayoutEngine';

const W = 200;
const H = 64;

function build(
  nodes: Array<{ id: string; x: number; y: number; parentId?: string; isGroup?: boolean }>,
  edges: Array<[string, string]>,
): { params: LayoutParams; result: LayoutResult } {
  const layoutNodes = nodes.map(n => ({ id: n.id, width: n.isGroup ? 400 : W, height: n.isGroup ? 600 : H, parentId: n.parentId, isGroup: n.isGroup }));
  const params: LayoutParams = {
    nodes: layoutNodes,
    edges: edges.map(([source, target], i) => ({ id: `e${i}`, source, target })),
    direction: 'LR',
  };
  const result: LayoutResult = {
    nodes: nodes.map(n => ({ ...layoutNodes.find(l => l.id === n.id)!, x: n.x, y: n.y })),
    edges: [],
    warnings: [],
  };
  return { params, result };
}

const centerY = (result: LayoutResult, id: string) => {
  const node = result.nodes.find(n => n.id === id)!;
  return node.y + node.height / 2;
};

describe('symmetrizeFans', () => {
  it('centers a node on the middle of its branches', () => {
    const { params, result } = build(
      [
        { id: 'a', x: 0, y: 300 },
        { id: 'b', x: 400, y: 0 },
        { id: 'c', x: 400, y: 200 },
        { id: 'd', x: 400, y: 400 },
      ],
      [['a', 'b'], ['a', 'c'], ['a', 'd']],
    );
    const next = symmetrizeFans(result, params);
    expect(centerY(next, 'a')).toBeCloseTo(centerY(next, 'c'), 1);
  });

  it('centers a fan-in target on its sources', () => {
    const { params, result } = build(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: 300 },
        { id: 't', x: 400, y: 0 },
      ],
      [['a', 't'], ['b', 't']],
    );
    const next = symmetrizeFans(result, params);
    expect(centerY(next, 't')).toBeCloseTo((centerY(next, 'a') + centerY(next, 'b')) / 2, 1);
  });

  it('moves the straight chain behind a fan node with it, so the chain stays straight', () => {
    const { params, result } = build(
      [
        { id: 'pre', x: 0, y: 300 },
        { id: 'hub', x: 300, y: 300 },
        { id: 'x', x: 600, y: 0 },
        { id: 'y', x: 600, y: 120 },
        { id: 'z', x: 600, y: 240 },
      ],
      [['pre', 'hub'], ['hub', 'x'], ['hub', 'y'], ['hub', 'z']],
    );
    const next = symmetrizeFans(result, params);
    expect(centerY(next, 'hub')).toBeCloseTo(centerY(next, 'y'), 1);
    expect(centerY(next, 'pre')).toBeCloseTo(centerY(next, 'hub'), 1);
  });

  it('never overlaps a neighbour or reorders a column', () => {
    const { params, result } = build(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'blocker', x: 0, y: 90 },
        { id: 'b', x: 400, y: 300 },
        { id: 'c', x: 400, y: 420 },
      ],
      [['a', 'b'], ['a', 'c']],
    );
    const next = symmetrizeFans(result, params);
    const a = next.nodes.find(n => n.id === 'a')!;
    const blocker = next.nodes.find(n => n.id === 'blocker')!;
    expect(a.y + a.height + 16).toBeLessThanOrEqual(blocker.y + 0.5);
  });

  it('keeps a grouped node inside the range its group already covers', () => {
    const { params, result } = build(
      [
        { id: 'g', x: 380, y: 0, isGroup: true },
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 400, y: 0, parentId: 'g' },
        { id: 'c', x: 400, y: 100, parentId: 'g' },
        { id: 'p', x: 400, y: 200, parentId: 'g' },
        { id: 'q', x: 700, y: 0, parentId: 'g' },
        { id: 'r', x: 700, y: 400, parentId: 'g' },
      ],
      [['p', 'q'], ['p', 'r'], ['a', 'b']],
    );
    const next = symmetrizeFans(result, params);
    const ys = next.nodes.filter(n => n.parentId === 'g').map(n => [n.y, n.y + n.height]);
    const lo = Math.min(...ys.map(([top]) => top));
    const hi = Math.max(...ys.map(([, bottom]) => bottom));
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(464);
  });

  it('leaves fans whose branches sit in different groups where they are', () => {
    const { params, result } = build(
      [
        { id: 'g1', x: 380, y: 0, isGroup: true },
        { id: 'g2', x: 380, y: 400, isGroup: true },
        { id: 'a', x: 0, y: 100 },
        { id: 'b', x: 400, y: 0, parentId: 'g1' },
        { id: 'c', x: 400, y: 500, parentId: 'g2' },
      ],
      [['a', 'b'], ['a', 'c']],
    );
    const next = symmetrizeFans(result, params);
    expect(next.nodes.find(n => n.id === 'a')!.y).toBe(100);
  });
});
