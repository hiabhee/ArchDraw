import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { decorPrimitives, estimateStatSize, statIconName, statLayout, withoutDecorNodes } from '../infographicNodes';
import { computeDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';
import { checkRawGraph } from '@/lib/server/rawGraphGuard';

const card = (id: string, x: number, y: number): Node => ({ id, type: 'shapeNode', position: { x, y }, width: 200, height: 90, data: { label: id, shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 90 } });
const panel = (id: string, x: number, y: number, width: number, height: number): Node => ({ id, type: 'decorNode', position: { x, y }, width, height, style: { width, height }, zIndex: -1, data: { kind: 'rectangle', fill: '#223344' } });

describe('decorPrimitives', () => {
  it('draws a panel, a circle, a line and an arrow', () => {
    expect(decorPrimitives({ kind: 'rectangle', radius: 12 }, 300, 100, false)[0]).toMatchObject({ tag: 'rect', attrs: { rx: 12, width: 300, height: 100 } });
    expect(decorPrimitives({ kind: 'circle' }, 80, 80, true)[0]).toMatchObject({ tag: 'ellipse', attrs: { cx: 40, cy: 40, rx: 40 } });
    expect(decorPrimitives({ kind: 'line', from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 } }, 200, 24, false)[0]).toMatchObject({ tag: 'line', attrs: { x1: 0, y1: 12, x2: 200, y2: 12 } });
    const arrow = decorPrimitives({ kind: 'arrow' }, 200, 24, false);
    expect(arrow.map(p => p.tag)).toEqual(['line', 'path']);
  });

  it('ignores colours that are not #rrggbb', () => {
    const [rect] = decorPrimitives({ kind: 'rectangle', fill: 'url(javascript:x)' }, 10, 10, false);
    expect(String(rect.attrs.fill)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('statNode', () => {
  it('lays out value, label and caption top to bottom inside the card', () => {
    const size = estimateStatSize('99.9%', 'uptime', 'across three regions', true);
    const layout = statLayout({ value: '99.9%', label: 'uptime', caption: 'across three regions', icon: 'globe' }, size.width, size.height, false, true);
    expect(layout.icon).toBeDefined();
    expect(layout.value!.y).toBeLessThan(layout.label!.y);
    expect(layout.label!.y).toBeLessThan(layout.caption!.y);
    expect(layout.caption!.y).toBeLessThanOrEqual(size.height);
  });

  it('shrinks a value too wide for its card rather than clipping it', () => {
    const layout = statLayout({ value: '1,234,567,890' }, 200, 120, false, false);
    expect(layout.value!.px).toBeLessThan(44);
  });

  it('resolves icons by name or by word', () => {
    expect(statIconName({ icon: 'database' }, false)).not.toBeNull();
    expect(statIconName({}, false)).toBeNull();
  });
});

describe('decoration and routing', () => {
  it('a panel under two cards never blocks their connection', () => {
    const nodes = [panel('p', -40, -40, 800, 200), card('a', 0, 0), card('b', 500, 0)];
    const edges: Edge[] = [{ id: 'e', source: 'a', target: 'b' }];
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR' });
    expect(plan.violations.filter(v => v.code === 'OBSTACLE_INTERSECTION' || v.code === 'NODE_COLLISION')).toEqual([]);
    expect(withoutDecorNodes(nodes).map(n => n.id)).toEqual(['a', 'b']);
  });

  it('the export draws decoration under the connections and stats with the cards', () => {
    const stat: Node = { id: 's', type: 'statNode', position: { x: 0, y: 300 }, width: 220, height: 150, style: { width: 220, height: 150 }, data: { value: '3x', label: 'faster' } };
    const svg = generatePureSVG([panel('p', -40, -40, 800, 200), card('a', 0, 0), card('b', 500, 0), stat], [{ id: 'e', source: 'a', target: 'b' }], false, '#ffffff', 'LR', 'studio-minimal');
    expect(svg.indexOf('<g id="decor">')).toBeLessThan(svg.indexOf('<g id="edges">'));
    expect(svg).toContain('fill="#223344"');
    expect(svg).toContain('>3x</text>');
  });

  it('raw graphs may carry both kinds', () => {
    expect(checkRawGraph([panel('p', 0, 0, 10, 10), { id: 's', type: 'statNode', position: { x: 0, y: 0 }, data: {} }], [])).toBeNull();
  });
});
