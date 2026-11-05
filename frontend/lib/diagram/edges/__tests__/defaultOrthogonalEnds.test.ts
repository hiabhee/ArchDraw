import { describe, expect, it } from 'vitest';
import { Position } from 'reactflow';
import { buildDefaultOrthogonalWaypoints } from '../handlerPairScorer';

/**
 * The edge drawn while a node is dragged is this path, and its target point (where
 * the arrowhead and the label sit) is the path's last point, not its second: with a
 * bend in the path the second point is a corner.
 */
const SIDES = [Position.Left, Position.Right, Position.Top, Position.Bottom];

describe('buildDefaultOrthogonalWaypoints ends', () => {
  const source = { x: 100, y: 80 };
  const targets = [{ x: 420, y: 260 }, { x: 420, y: 80 }, { x: 100, y: 300 }, { x: -200, y: -90 }];

  it('starts at the source and ends at the target for every pair of sides', () => {
    for (const target of targets) {
      for (const sourceSide of SIDES) {
        for (const targetSide of SIDES) {
          const path = buildDefaultOrthogonalWaypoints(source, target, sourceSide, targetSide, 0);
          const label = `${sourceSide}→${targetSide} to (${target.x},${target.y})`;
          expect(path.length, label).toBeGreaterThanOrEqual(2);
          expect(path[0], `${label} first`).toEqual(source);
          expect(path[path.length - 1], `${label} last`).toEqual(target);
        }
      }
    }
  });

  it('puts bends between the ends, so the second point is not the target', () => {
    const path = buildDefaultOrthogonalWaypoints({ x: 0, y: 0 }, { x: 300, y: 200 }, Position.Right, Position.Left, 0);
    expect(path.length).toBeGreaterThan(2);
    expect(path[1]).not.toEqual({ x: 300, y: 200 });
  });
});
