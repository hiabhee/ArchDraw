import { describe, expect, it } from 'vitest';
import { foldLongFlows, type FoldableNode } from '../layout/foldLongFlows';
import { measureLayoutAesthetics } from '../layout/layoutAesthetics';

const leaf = (id: string, x: number, y = 0, parentNode?: string): FoldableNode & { width: number; height: number } =>
  ({ id, position: { x, y }, width: 200, height: 80, parentNode });

/** A single row of `count` stages, 320px apart: far too wide for a screen. */
function longRow(count: number): FoldableNode[] {
  return Array.from({ length: count }, (_, i) => leaf(`s${i}`, i * 320));
}

describe('foldLongFlows', () => {
  it('leaves a short flow alone', () => {
    const nodes = longRow(2);
    expect(foldLongFlows(nodes)).toEqual(nodes);
  });

  it('folds a long single-row flow into rows that fit the screen far better', () => {
    const nodes = longRow(12);
    const folded = foldLongFlows(nodes);
    expect(folded).not.toBe(nodes);
    const before = measureLayoutAesthetics(nodes as never, [], 'LR').fitScale;
    const after = measureLayoutAesthetics(folded as never, [], 'LR').fitScale;
    expect(after).toBeGreaterThan(before * 1.5);
  });

  it('never overlaps two units and keeps each group\'s children inside it', () => {
    const nodes: FoldableNode[] = [];
    for (let i = 0; i < 8; i++) {
      const x = i * 340;
      nodes.push({ id: `g${i}`, position: { x, y: 0 }, width: 300, height: 160 });
      nodes.push(leaf(`g${i}_a`, x + 20, 40, `g${i}`));
      nodes.push(leaf(`g${i}_b`, x + 20, 100, `g${i}`));
    }
    const folded = foldLongFlows(nodes);
    const groups = folded.filter(node => !node.parentNode);
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        const overlaps = a.position.x < b.position.x + 300 && b.position.x < a.position.x + 300
          && a.position.y < b.position.y + 160 && b.position.y < a.position.y + 160;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    for (const child of folded.filter(node => node.parentNode)) {
      const group = folded.find(node => node.id === child.parentNode)!;
      expect(child.position.x - group.position.x).toBeGreaterThanOrEqual(0);
      expect(child.position.x + 200 - group.position.x).toBeLessThanOrEqual(300);
    }
  });

  /** `columns` ranks 320px apart, each a stack of `height` nodes 100px apart. */
  function ranks(columns: number, stack: number): Array<FoldableNode & { width: number; height: number }> {
    const nodes: Array<FoldableNode & { width: number; height: number }> = [];
    for (let c = 0; c < columns; c++) for (let r = 0; r < stack; r++) nodes.push(leaf(`c${c}r${r}`, c * 320, r * 100));
    return nodes;
  }
  const at = (nodes: readonly FoldableNode[], id: string) => nodes.find(node => node.id === id)!.position;

  it('keeps the nodes of one rank together, at the same relative heights', () => {
    const nodes = ranks(10, 3);
    const folded = foldLongFlows(nodes);
    expect(folded).not.toEqual(nodes);
    for (let c = 0; c < 10; c++) {
      const [a, b, d] = [at(folded, `c${c}r0`), at(folded, `c${c}r1`), at(folded, `c${c}r2`)];
      expect(b.x).toBe(a.x);
      expect(d.x).toBe(a.x);
      expect(b.y - a.y).toBe(100);
      expect(d.y - b.y).toBe(100);
    }
  });

  it('wraps like a serpentine: the second row starts under the end of the first', () => {
    const nodes = longRow(8);
    const folded = foldLongFlows(nodes);
    const rowOf = (id: string) => at(folded, id).y;
    const firstRow = nodes.filter(node => rowOf(node.id) === rowOf('s0')).map(node => node.id);
    expect(firstRow.length).toBeGreaterThan(0);
    expect(firstRow.length).toBeLessThan(8);
    const last = firstRow[firstRow.length - 1];
    const next = `s${firstRow.length}`;
    expect(at(folded, next).x).toBeCloseTo(at(folded, last).x, 5);
    expect(at(folded, next).y).toBeGreaterThan(at(folded, last).y);
  });

  it('keeps the gap the layout gave two columns, so their edge labels still fit', () => {
    const nodes = [leaf('a', 0), leaf('b', 700), leaf('c', 1040), leaf('d', 1380), leaf('e', 1720), leaf('f', 2060)];
    const folded = foldLongFlows(nodes);
    expect(folded).not.toEqual(nodes);
    // a and b share a row when the rows are balanced; their 500px gap is kept.
    if (at(folded, 'a').y === at(folded, 'b').y) {
      expect(at(folded, 'b').x - at(folded, 'a').x).toBe(700);
    }
  });

  it('folds a long top-down flow into lanes', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => leaf(`s${i}`, 0, i * 200));
    const folded = foldLongFlows(nodes, { direction: 'TD' });
    expect(folded).not.toEqual(nodes);
    const before = measureLayoutAesthetics(nodes as never, [], 'TD').fitScale;
    const after = measureLayoutAesthetics(folded as never, [], 'TD').fitScale;
    expect(after).toBeGreaterThan(before * 1.3);
    expect(new Set(folded.map(node => node.position.x)).size).toBeGreaterThan(1);
  });

  it('does not fold a flow that already suits the screen', () => {
    const nodes = ranks(5, 3);
    const before = measureLayoutAesthetics(nodes as never, [], 'LR').fitScale;
    const folded = foldLongFlows(nodes);
    const after = measureLayoutAesthetics(folded as never, [], 'LR').fitScale;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('never overlaps two nodes, however many ranks there are', () => {
    for (const columns of [4, 7, 12, 25]) {
      const folded = foldLongFlows(ranks(columns, 2));
      for (let i = 0; i < folded.length; i++) {
        for (let j = i + 1; j < folded.length; j++) {
          const a = folded[i].position, b = folded[j].position;
          const overlaps = a.x < b.x + 200 && b.x < a.x + 200 && a.y < b.y + 80 && b.y < a.y + 80;
          expect(overlaps, `${folded[i].id} overlaps ${folded[j].id} (${columns} ranks)`).toBe(false);
        }
      }
    }
  });
});
