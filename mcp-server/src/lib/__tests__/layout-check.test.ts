import { describe, expect, it } from 'vitest';
import { checkLayout, labelPillWidth, type LayoutBox } from '../layout-check.js';

const card = (id: string, x: number, y: number, extra: Partial<LayoutBox> = {}): LayoutBox => ({ id, type: 'shapeNode', x, y, width: 200, height: 80, text: id, ...extra });
const group = (id: string, x: number, y: number, width: number, height: number): LayoutBox => ({ id, type: 'groupNode', x, y, width, height, text: id });
const kinds = (boxes: LayoutBox[], edges: Parameters<typeof checkLayout>[1] = []) => checkLayout(boxes, edges).map(issue => issue.kind);

describe('checkLayout', () => {
  it('finds nothing wrong in a tidy layout', () => {
    const boxes = [group('g', 0, 0, 300, 300), card('a', 40, 60, { parent: 'g' }), card('b', 600, 60)];
    expect(checkLayout(boxes, [{ source: 'a', target: 'b', label: 'call' }])).toEqual([]);
  });

  it('reports two cards on top of each other', () => {
    expect(kinds([card('a', 0, 0), card('b', 100, 40)])).toEqual(['overlap']);
  });

  it('reports overlapping groups', () => {
    expect(kinds([group('g1', 0, 0, 300, 300), group('g2', 250, 0, 300, 300)])).toEqual(['group-overlap']);
  });

  it('reports a card sticking out of its group, and by how much', () => {
    const [issue] = checkLayout([group('g', 0, 0, 300, 200), card('a', 150, 40, { parent: 'g' })]);
    expect(issue.kind).toBe('outside-group');
    expect(issue.message).toContain('50px on the right');
  });

  it('reports a card drawn over a group it is not in', () => {
    expect(kinds([group('g', 0, 0, 300, 300), card('a', 250, 100)])).toEqual(['over-other-group']);
  });

  it('reports connected cards too close for their label, side by side and stacked', () => {
    const side = checkLayout([card('a', 0, 0), card('b', 260, 0)], [{ source: 'a', target: 'b', data: { label: 'encrypted msg' } }]);
    expect(side.map(issue => issue.kind)).toEqual(['label-gap']);
    expect(side[0].message).toContain('"encrypted msg"');
    const stacked = checkLayout([card('a', 0, 0), card('b', 0, 100)], [{ source: 'a', target: 'b', label: 'persist' }]);
    expect(stacked.map(issue => issue.kind)).toEqual(['label-gap']);
  });

  it('accepts a label when the gap holds it', () => {
    const gap = labelPillWidth('encrypted msg') + 40;
    expect(checkLayout([card('a', 0, 0), card('b', 200 + gap, 0)], [{ source: 'a', target: 'b', label: 'encrypted msg' }])).toEqual([]);
  });

  it('caps the number of reported problems', () => {
    const many = Array.from({ length: 12 }, (_, i) => card(`c${i}`, i * 10, 0));
    expect(checkLayout(many, [], 5)).toHaveLength(5);
  });
});

describe('decoration', () => {
  it('does not report cards on a panel as overlapping it', () => {
    const issues = checkLayout([
      { id: 'panel', type: 'decorNode', x: 0, y: 0, width: 800, height: 300 },
      { id: 'a', type: 'statNode', x: 40, y: 40, width: 200, height: 150 },
    ]);
    expect(issues).toEqual([]);
  });
});
