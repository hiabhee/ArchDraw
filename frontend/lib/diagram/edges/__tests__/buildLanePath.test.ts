import { describe, expect, it } from 'vitest';
import { Position } from 'reactflow';
import { buildLanePath } from '../edgeRouteBuilder';

const horizontal = (p: Position) => p === Position.Left || p === Position.Right;

describe('buildLanePath', () => {
  const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];
  for (const source of sides) {
    for (const target of sides) {
      it(`leaves ${source} and enters ${target} straight on`, () => {
        const sh = { x: 100, y: 100 };
        const th = { x: 900, y: 500 };
        const path = buildLanePath(sh, th, source, target, 28, 32);
        // First and last segments are perpendicular to their handle's side.
        const [a, b] = path;
        const [y, z] = path.slice(-2);
        if (horizontal(source)) expect(b.y).toBe(a.y); else expect(b.x).toBe(a.x);
        if (horizontal(target)) expect(y.y).toBe(z.y); else expect(y.x).toBe(z.x);
        // Every segment is orthogonal.
        for (let i = 1; i < path.length; i++) {
          expect(path[i].x === path[i - 1].x || path[i].y === path[i - 1].y).toBe(true);
        }
      });
    }
  }

  it('fixes the bottom → left hook (enters the left handle horizontally)', () => {
    const path = buildLanePath({ x: 1020, y: 2348 }, { x: 3476, y: 2572 }, Position.Bottom, Position.Left, 28, 32);
    const [y, z] = path.slice(-2);
    expect(y).toEqual({ x: 3444, y: 2572 });
    expect(z).toEqual({ x: 3476, y: 2572 });
  });
});
