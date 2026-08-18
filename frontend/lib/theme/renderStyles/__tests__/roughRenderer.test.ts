import { describe, expect, it } from 'vitest';
import { RoughStrokeRenderer } from '../strokeRenderer/roughRenderer';
import { CrispStrokeRenderer } from '../strokeRenderer/crispRenderer';
import { SKETCH_ROUGH_OPTIONS } from '../sketch';
import type { ShapePrimitive } from '../types';

describe('RoughStrokeRenderer', () => {
  const renderer = new RoughStrokeRenderer(SKETCH_ROUGH_OPTIONS);

  it('produces deterministic seeds from ids', () => {
    expect(renderer.seedFor('node-1')).toBe(renderer.seedFor('node-1'));
    expect(renderer.seedFor('node-1')).not.toBe(renderer.seedFor('node-2'));
  });

  it('renders a rectangle primitive to rough <path> markup', () => {
    const primitive: ShapePrimitive = {
      kind: 'rect',
      bounds: { x: 0, y: 0, width: 200, height: 96 },
      fill: '#ffffff',
      stroke: '#0f766e',
      strokeWidth: 1.75,
    };
    const markup = renderer.renderPrimitive(primitive, 42);
    expect(markup).toContain('<path');
    expect(markup).toContain('d="');
    expect(markup).toContain('stroke="#0f766e"');
    expect(markup).toContain('fill=');
  });

  it('renders a polygon primitive via rough polygon', () => {
    const primitive: ShapePrimitive = {
      kind: 'polygon',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      points: '50,4 96,50 50,96 4,50',
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 1.5,
    };
    expect(renderer.renderPrimitive(primitive, 7)).toContain('<path');
  });

  it('is stable across calls with the same seed', () => {
    const a = renderer.renderPrimitive(
      { kind: 'ellipse', bounds: { x: 2, y: 2, width: 60, height: 40 }, fill: '#fff', stroke: '#000', strokeWidth: 1.5 },
      99,
    );
    const b = renderer.renderPrimitive(
      { kind: 'ellipse', bounds: { x: 2, y: 2, width: 60, height: 40 }, fill: '#fff', stroke: '#000', strokeWidth: 1.5 },
      99,
    );
    expect(a).toBe(b);
  });

  it('renders an edge path', () => {
    const markup = renderer.renderEdgePath('M 0 0 C 20 0, 40 0, 60 0', {
      d: 'M 0 0 C 20 0, 40 0, 60 0',
      stroke: '#94a3b8',
      strokeWidth: 1.75,
    }, 5);
    expect(markup).toContain('<path');
  });

  it('emits semantic stroke-dasharray on dashed edges with increased thickness', () => {
    const path = 'M 0 0 C 20 0, 40 0, 60 0 C 80 0, 100 0, 120 0';
    const markup = renderer.renderEdgePath(path, {
      d: path,
      stroke: '#94a3b8',
      strokeWidth: 1.75,
      dasharray: '6 4',
    }, 5);
    expect(markup).toContain('stroke-dasharray="6 4"');
    // Dashed edges are made 15% thicker for better visibility: 1.75 * 1.15 ≈ 2.01
    expect(markup).toMatch(/stroke-width="2\.01/);
    // Single wobbly stroke — no rough.js double-pass subpaths.
    const subpaths = (markup.match(/d="([^"]+)"/)?.[1].match(/ M /g) ?? []).length + 1;
    expect(subpaths).toBe(1);
  });

  it('renders a rounded-rect body like the SystemNode sketch overlay', () => {
    const markup = renderer.renderPrimitive(
      { kind: 'rounded-rect', bounds: { x: 0, y: 0, width: 204, height: 100 }, rx: 14, fill: '#fffef9', stroke: '#1e293b', strokeWidth: 1.75 },
      renderer.seedFor('system-1'),
    );
    expect(markup).toContain('<path');
    // Outline carries the stroke; the paper fill is cross-hatched as strokes.
    expect(markup).toContain('stroke="#1e293b"');
    expect(markup).toContain('stroke-width="1.75"');
    expect(markup).toContain('stroke="#fffef9"');
  });

  it('boosts faint theme-token strokes so sketch borders read as ink', () => {
    const markup = renderer.renderPrimitive(
      { kind: 'rect', bounds: { x: 0, y: 0, width: 200, height: 96 }, fill: '#ffffff', stroke: 'rgba(15, 23, 42, 0.14)', strokeWidth: 1.75 },
      3,
    );
    expect(markup).toContain('stroke="rgba(15, 23, 42, 0.55)"');
  });

  it('leaves opaque (selected / accent) strokes untouched', () => {
    const markup = renderer.renderPrimitive(
      { kind: 'rect', bounds: { x: 0, y: 0, width: 200, height: 96 }, fill: '#ffffff', stroke: '#0f766e', strokeWidth: 1.75 },
      3,
    );
    expect(markup).toContain('stroke="#0f766e"');
  });

  it('renders an arrowhead at a point', () => {
    const markup = renderer.renderArrowhead({ x: 100, y: 50 }, Math.PI, '#0f766e', 8);
    expect(markup).toContain('<path');
    // Open chevron — two bare ink arms meeting at the tip, no filled blob.
    expect(markup.match(/<path/g)?.length).toBe(2);
  });
});

describe('CrispStrokeRenderer', () => {
  const renderer = new CrispStrokeRenderer();

  it('renders exact SVG markup for a rounded rect', () => {
    const markup = renderer.renderPrimitive(
      { kind: 'rounded-rect', bounds: { x: 1, y: 1, width: 198, height: 94 }, rx: 10, fill: '#fff', stroke: '#000', strokeWidth: 1.25 },
      0,
    );
    expect(markup).toBe('<rect x="1" y="1" width="198" height="94" rx="10" ry="10" fill="#fff" stroke="#000" stroke-width="1.25" />');
  });

  it('renders a polygon with points', () => {
    const markup = renderer.renderPrimitive(
      { kind: 'polygon', bounds: { x: 0, y: 0, width: 200, height: 100 }, points: '100,4 196,50 100,96 4,50', fill: '#fff', stroke: '#000', strokeWidth: 1.25 },
      0,
    );
    expect(markup).toContain('points="100,4 196,50 100,96 4,50"');
    expect(markup).toContain('fill="#fff"');
  });

  it('renders edge paths with dash support', () => {
    const markup = renderer.renderEdgePath('M 0 0 L 50 50', { d: 'M 0 0 L 50 50', stroke: '#0f766e', strokeWidth: 1.5, dasharray: '6 4' }, 0);
    expect(markup).toContain('stroke-dasharray="6 4"');
    expect(markup).toContain('fill="none"');
  });
});
