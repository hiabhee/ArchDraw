import { describe, expect, it } from 'vitest';
import { routeEndsAt } from '../edgeRouteBuilder';

const route = { sourcePoint: { x: 100, y: 50 }, targetPoint: { x: 400, y: 90 } };

describe('routeEndsAt', () => {
  it('accepts a route that still ends at the handles', () => {
    expect(routeEndsAt(route, { x: 100, y: 50 }, { x: 400, y: 90 })).toBe(true);
    expect(routeEndsAt(route, { x: 100.8, y: 49.4 }, { x: 399.5, y: 90.9 })).toBe(true);
  });

  it('rejects a route planned for a node that has since moved', () => {
    expect(routeEndsAt(route, { x: 100, y: 50 }, { x: 400, y: 130 })).toBe(false);
    expect(routeEndsAt(route, { x: 140, y: 50 }, { x: 400, y: 90 })).toBe(false);
  });
});
