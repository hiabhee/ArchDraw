import { describe, expect, it } from 'vitest';
import { alignGroupCentres, packGroupColumns } from '../layout/columnPacking';

const card = (id: string, x: number, y: number, parentNode?: string) => ({ id, type: 'shapeNode', parentNode, position: { x, y }, width: 200, height: 80 });
const group = (id: string, x: number, y: number) => ({ id, type: 'groupNode', position: { x, y }, width: 0, height: 0 });

describe('packGroupColumns', () => {
  it('closes wide gaps in a group column around its centre, keeping order', () => {
    const nodes = [group('g', 0, 0), card('a', 0, 0, 'g'), card('b', 0, 400, 'g'), card('c', 0, 480 + 48, 'g')];
    const packed = packGroupColumns(nodes, 'LR', { gap: 48 })!;
    const ys = packed.filter(n => n.type === 'shapeNode').map(n => n.position.y);
    expect(ys[1] - (ys[0] + 80)).toBe(48);
    expect(ys[2] - (ys[1] + 80)).toBe(48);
    // Centre kept: the column spanned 0..608.
    expect((ys[0] + ys[2] + 80) / 2).toBeCloseTo(304);
  });

  it('leaves columns with ordinary gaps alone', () => {
    const nodes = [group('g', 0, 0), card('a', 0, 0, 'g'), card('b', 0, 140, 'g')];
    expect(packGroupColumns(nodes, 'LR', { gap: 48 })).toBeUndefined();
  });

  it('does not pack cards in different columns together', () => {
    const nodes = [group('g', 0, 0), card('a', 0, 0, 'g'), card('b', 400, 600, 'g')];
    expect(packGroupColumns(nodes, 'LR', { gap: 48 })).toBeUndefined();
  });
});

describe('alignGroupCentres', () => {
  it('moves a group and its cards onto the shared line', () => {
    const nodes = [
      group('g1', 0, 0), card('a', 0, 0, 'g1'),
      group('g2', 400, 0), card('b', 400, 0, 'g2'),
      group('g3', 800, 0), card('c', 800, 300, 'g3'),
    ];
    const aligned = alignGroupCentres(nodes, 'LR')!;
    const at = (id: string) => aligned.find(n => n.id === id)!.position;
    expect(at('c').y).toBe(0);
    expect(at('g3').y).toBe(-300);
    expect(at('a').y).toBe(0);
  });

  it('keeps a group where it is when the move would collide', () => {
    const nodes = [
      group('g1', 0, 0), card('a', 0, 0, 'g1'),
      group('g2', 0, 300), card('b', 0, 300, 'g2'),
    ];
    expect(alignGroupCentres(nodes, 'LR', { only: 'g2' })).toBeUndefined();
  });
});
