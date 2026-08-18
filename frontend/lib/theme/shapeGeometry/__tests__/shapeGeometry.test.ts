import { describe, expect, it } from 'vitest';
import { getShapePrimitives } from '../index';

describe('getShapePrimitives', () => {
  const shapes = [
    'rectangle',
    'rounded-rectangle',
    'dashed-rectangle',
    'diamond',
    'circle',
    'parallelogram',
    'hexagon',
    'cloud',
    'actor',
    'monitor',
    'mobile',
    // New architecture-native shapes
    'queue',
    'cache',
    'function',
    'container',
    'bucket',
  ] as const;

  it.each(shapes)('returns primitives for %s', (shape) => {
    const primitives = getShapePrimitives(shape, 200, 100);
    expect(primitives.length).toBeGreaterThan(0);
    for (const p of primitives) {
      expect(p.bounds).toBeDefined();
      expect(p.bounds.width).toBeGreaterThan(0);
      expect(p.bounds.height).toBeGreaterThan(0);
    }
  });

  it('marks the first primitive as fillable body for core shapes', () => {
    expect(getShapePrimitives('rectangle', 200, 100)[0].fillable).toBe(true);
    expect(getShapePrimitives('diamond', 200, 100)[0].kind).toBe('polygon');
    expect(getShapePrimitives('circle', 200, 100)[0].kind).toBe('ellipse');
  });

  it('uses a dashed rounded-rect for dashed-rectangle', () => {
    const [body] = getShapePrimitives('dashed-rectangle', 200, 100);
    expect(body.kind).toBe('rounded-rect');
    expect(body.dasharray).toBe('6 4');
  });

  it('returns vertical drum primitives by default and horizontal pipe when axis horizontal', () => {
    const drum = getShapePrimitives('cylinder', 200, 100);
    const pipe = getShapePrimitives('cylinder', 200, 100, 'horizontal');
    expect(drum.some((p) => p.kind === 'ellipse')).toBe(true);
    expect(pipe.some((p) => p.kind === 'line')).toBe(true);
  });

  it('hexagon produces a six-vertex polygon', () => {
    const [body] = getShapePrimitives('hexagon', 200, 96);
    expect(body.kind).toBe('polygon');
    expect(body.points!.split(/\s+/).length).toBe(6);
  });

  it('is style-agnostic — no colors set', () => {
    for (const shape of shapes) {
      for (const p of getShapePrimitives(shape, 200, 100)) {
        expect(p.fill).toBeUndefined();
        expect(p.stroke).toBeUndefined();
      }
    }
  });

  // ── New shape tests ────────────────────────────────────────────────────────

  it('queue returns a fillable rounded-rect as first primitive', () => {
    const prims = getShapePrimitives('queue', 240, 64);
    expect(prims[0].kind).toBe('rounded-rect');
    expect(prims[0].fillable).toBe(true);
  });

  it('queue returns multiple primitives (body + 3 lane lines)', () => {
    const prims = getShapePrimitives('queue', 240, 64);
    expect(prims.length).toBeGreaterThanOrEqual(4);
    const lines = prims.filter((p) => p.kind === 'line');
    expect(lines.length).toBe(3);
    expect(lines.every((l) => l.strokeOnly)).toBe(true);
  });

  it('cache returns at least 3 primitives (2 shadow layers + fillable body)', () => {
    const prims = getShapePrimitives('cache', 180, 96);
    expect(prims.length).toBeGreaterThanOrEqual(3);
    const fillable = prims.filter((p) => p.fillable);
    expect(fillable.length).toBeGreaterThanOrEqual(1);
    const strokeOnly = prims.filter((p) => p.strokeOnly);
    expect(strokeOnly.length).toBeGreaterThanOrEqual(2);
  });

  it('function returns a fillable 8-point polygon', () => {
    const prims = getShapePrimitives('function', 180, 96);
    expect(prims.length).toBe(1);
    expect(prims[0].kind).toBe('polygon');
    expect(prims[0].fillable).toBe(true);
    // 8 points: 4 corners each cut once
    expect(prims[0].points!.split(/\s+/).length).toBe(8);
  });

  it('container returns fillable outer + 3 stroke-only inset cells', () => {
    const prims = getShapePrimitives('container', 220, 104);
    const fillable = prims.filter((p) => p.fillable);
    expect(fillable.length).toBe(1);
    expect(fillable[0].kind).toBe('rounded-rect');
    const cells = prims.filter((p) => p.strokeOnly);
    expect(cells.length).toBe(3);
  });

  it('bucket returns a fillable polygon + stroke-only rim', () => {
    const prims = getShapePrimitives('bucket', 180, 104);
    const fillable = prims.filter((p) => p.fillable);
    expect(fillable.length).toBe(1);
    expect(fillable[0].kind).toBe('polygon');
    const strokeOnly = prims.filter((p) => p.strokeOnly);
    expect(strokeOnly.length).toBeGreaterThanOrEqual(2);
  });

  it('all new shapes stay within passed bounds', () => {
    const newShapes: Array<'queue' | 'cache' | 'function' | 'container' | 'bucket'> = [
      'queue', 'cache', 'function', 'container', 'bucket',
    ];
    for (const shape of newShapes) {
      const W = 220;
      const H = 100;
      for (const p of getShapePrimitives(shape, W, H)) {
        expect(p.bounds.x).toBeGreaterThanOrEqual(-2);
        expect(p.bounds.y).toBeGreaterThanOrEqual(-H);
        expect(p.bounds.x + p.bounds.width).toBeLessThanOrEqual(W + 2);
      }
    }
  });
});
