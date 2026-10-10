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
});
