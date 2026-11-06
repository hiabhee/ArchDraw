import { describe, expect, it } from 'vitest';
import type { LayoutParams, LayoutResult } from '../layout/LayoutEngine';
import { equalizeColumns } from '../layout/columnSpacing';

const node = (id: string, x: number, y: number) => ({ id, x, y, width: 200, height: 100 });
const paramsFor = (ids: string[], edges: Array<[string, string]>): LayoutParams => ({
  direction: 'LR',
  nodes: ids.map(id => ({ id, width: 200, height: 100 })),
  edges: edges.map(([source, target]) => ({ source, target })),
} as unknown as LayoutParams);

describe('equalizeColumns', () => {
  it('spaces the middle of a column evenly and keeps both ends and the order', () => {
    const result = {
      nodes: [node('src', 0, 200), node('a', 400, 0), node('b', 400, 140), node('c', 400, 800)],
      edges: [], warnings: [],
    } as unknown as LayoutResult;
    const next = equalizeColumns(result, paramsFor(['src', 'a', 'b', 'c'], [['src', 'a'], ['src', 'b'], ['src', 'c']]));
    const y = Object.fromEntries(next.nodes.map(n => [n.id, n.y]));
    expect(y.a).toBe(0);
    expect(y.c).toBe(800);
    expect(y.b).toBeGreaterThan(y.a + 100);
    expect(y.b - (y.a + 100)).toBeCloseTo(y.c - (y.b + 100), 5);
  });

  it('leaves a node on a straight one-to-one link where it is', () => {
    const result = {
      nodes: [node('src', 0, 140), node('a', 400, 0), node('b', 400, 140), node('c', 400, 800)],
      edges: [], warnings: [],
    } as unknown as LayoutResult;
    const next = equalizeColumns(result, paramsFor(['src', 'a', 'b', 'c'], [['src', 'b']]));
    expect(next.nodes.find(n => n.id === 'b')!.y).toBe(140);
  });

  it('returns the same result when the gaps are already even', () => {
    const result = {
      nodes: [node('a', 400, 0), node('b', 400, 160), node('c', 400, 320)],
      edges: [], warnings: [],
    } as unknown as LayoutResult;
    expect(equalizeColumns(result, paramsFor(['a', 'b', 'c'], []))).toBe(result);
  });
});
