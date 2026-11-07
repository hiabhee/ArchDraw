import { describe, expect, it } from 'vitest';
import { alignMainSpine, mainSpine } from '../layout/spineAlign';

const card = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, type: 'shapeNode', position: { x, y }, width: 200, height: 80, ...extra });
const main = (source: string, target: string) => ({ source, target, data: { flowRole: 'main' } });
const centreY = (nodes: Array<{ id: string; position: { y: number }; height?: number }>, id: string) => {
  const n = nodes.find((node) => node.id === id)!;
  return n.position.y + (n.height ?? 0) / 2;
};

describe('alignMainSpine', () => {
  const zigzag = [card('a', 0, 0), card('b', 300, 30), card('c', 600, -20), card('d', 900, 0)];
  const chain = [main('a', 'b'), main('b', 'c'), main('c', 'd')];

  it('puts a zig-zagging main path on one straight line', () => {
    const aligned = alignMainSpine(zigzag, chain, 'LR')!;
    const lines = new Set(['a', 'b', 'c', 'd'].map((id) => Math.round(centreY(aligned, id))));
    expect(lines.size).toBe(1);
  });

  it('aligns on a requested line', () => {
    const aligned = alignMainSpine(zigzag, chain, 'LR', { target: 70 })!;
    for (const id of ['a', 'b', 'c', 'd']) expect(centreY(aligned, id)).toBeCloseTo(70, 5);
  });

  it('leaves a card where it is when moving it would bring it next to another card', () => {
    const blocker = card('x', 600, 120);
    const aligned = alignMainSpine([...zigzag, blocker], chain, 'LR', { target: 150 })!;
    // c would land on the blocker, so it stays.
    expect(aligned.find((n) => n.id === 'c')!.position.y).toBe(-20);
    expect(aligned.find((n) => n.id === 'x')!.position.y).toBe(120);
  });

  it('only moves the main path: branches and cards inside groups stay', () => {
    const branch = card('branch', 600, 300);
    const inGroup = card('inner', 300, 400, { parentNode: 'g' });
    const aligned = alignMainSpine([...zigzag, branch, inGroup], [...chain, { source: 'b', target: 'branch', data: { flowRole: 'branch' } }, main('c', 'inner')], 'LR')!;
    expect(aligned.find((n) => n.id === 'branch')!.position.y).toBe(300);
    expect(aligned.find((n) => n.id === 'inner')!.position.y).toBe(400);
  });

  it('does nothing without a main path of three cards', () => {
    expect(alignMainSpine(zigzag.slice(0, 2), [main('a', 'b')], 'LR')).toBeUndefined();
    expect(mainSpine(zigzag, [], 'LR')).toEqual({ ids: [], lines: [] });
  });
});
