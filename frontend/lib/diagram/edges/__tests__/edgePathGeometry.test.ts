import { describe, expect, it } from 'vitest';
import { buildEdgePathGeometry, pointAtRenderedPath, validateRenderedPath } from '../edgePathGeometry';

describe('shared rendered edge path geometry', () => {
  it('keeps the rounded SVG path, commands, and samples consistent', () => {
    const path = buildEdgePathGeometry({
      kind: 'orthogonal',
      waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      cornerRadius: 20,
    });

    expect(path.d).toContain('A 20,20');
    expect(path.commands.some(command => command.kind === 'arc')).toBe(true);
    expect(path.samples.length).toBeGreaterThan(4);
    expect(path.length).toBeGreaterThan(150);
    expect(pointAtRenderedPath(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtRenderedPath(path, 1)).toEqual({ x: 100, y: 100 });
  });

  it('validates sampled rounded and cubic geometry against obstacles', () => {
    const rounded = buildEdgePathGeometry({
      kind: 'orthogonal',
      waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      cornerRadius: 20,
    });
    const cubic = buildEdgePathGeometry({
      kind: 'cubic',
      start: { x: 0, y: 0 }, control1: { x: 0, y: 100 },
      control2: { x: 100, y: 100 }, end: { x: 100, y: 0 },
    });

    expect(validateRenderedPath(rounded, [{ id: 'corner', rect: { x: 80, y: 10, width: 20, height: 20 } }], 0))
      .toContainEqual({ code: 'PATH_OBSTACLE_INTERSECTION', obstacleId: 'corner' });
    expect(validateRenderedPath(cubic, [{ id: 'loop', rect: { x: 45, y: 70, width: 10, height: 10 } }], 0))
      .toContainEqual({ code: 'PATH_OBSTACLE_INTERSECTION', obstacleId: 'loop' });
  });
  it('does not round a 180° spike into a stray tick', () => {
    const path = buildEdgePathGeometry({
      kind: 'orthogonal',
      waypoints: [{ x: 108, y: 0 }, { x: 108, y: 112 }, { x: 130, y: 112 }, { x: 0, y: 112 }],
      cornerRadius: 24,
    });

    expect(path.d).toBe('M 108,0 L 108,88 A 24,24 0 0,1 84,112 L 0,112');
  });

  it('treats subpixel drift on a straight run as straight, not a semicircle', () => {
    const path = buildEdgePathGeometry({
      kind: 'orthogonal',
      waypoints: [{ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 400, y: 100.4 }],
      cornerRadius: 24,
    });

    expect(path.commands.some(command => command.kind === 'arc')).toBe(false);
  });
});
