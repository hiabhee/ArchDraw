import { describe, expect, it } from 'vitest';
import { Position } from 'reactflow';
import { buildDragPreviewRoute } from '../dragPreviewRoute';
import { HANDLER_ENDPOINT_GAP } from '../handlerPairScorer';

const box = (x: number, y: number, width = 200, height = 100) => ({ x, y, width, height });
const source = box(0, 0);

describe('buildDragPreviewRoute', () => {
  it('leaves the source on its right and reaches a target to the right on its left', () => {
    const route = buildDragPreviewRoute(source, box(500, 0));
    expect(route.sourcePosition).toBe(Position.Right);
    expect(route.targetPosition).toBe(Position.Left);
    expect(route.waypoints[0]).toEqual({ x: 200 + HANDLER_ENDPOINT_GAP, y: 50 });
    expect(route.waypoints[route.waypoints.length - 1]).toEqual({ x: 500 - HANDLER_ENDPOINT_GAP, y: 50 });
  });

  it('switches sides as the target is dragged from the right of the source to its left', () => {
    const toTheRight = buildDragPreviewRoute(source, box(500, 0));
    const toTheLeft = buildDragPreviewRoute(source, box(-500, 0));
    expect(toTheRight.sourcePosition).toBe(Position.Right);
    expect(toTheLeft.sourcePosition).toBe(Position.Left);
    expect(toTheLeft.targetPosition).toBe(Position.Right);
  });

  it('switches to the vertical sides when the target is dragged below the source', () => {
    const below = buildDragPreviewRoute(source, box(20, 500));
    expect([Position.Bottom, Position.Top]).toContain(below.sourcePosition);
    expect([Position.Bottom, Position.Top]).toContain(below.targetPosition);
  });

  it('changes the path as the target moves', () => {
    const near = buildDragPreviewRoute(source, box(500, 0));
    const moved = buildDragPreviewRoute(source, box(500, 180));
    expect(moved.waypoints).not.toEqual(near.waypoints);
    expect(moved.waypoints.length).toBeGreaterThan(near.waypoints.length - 1);
  });

  it('starts and ends at the anchors for any relative position', () => {
    for (const target of [box(500, 0), box(500, 200), box(-500, 60), box(20, 400), box(20, -400), box(-100, 300)]) {
      const route = buildDragPreviewRoute(source, target);
      expect(route.waypoints.length).toBeGreaterThanOrEqual(2);
      const [first, last] = [route.waypoints[0], route.waypoints[route.waypoints.length - 1]];
      expect(Number.isFinite(first.x + first.y + last.x + last.y)).toBe(true);
    }
  });
});
