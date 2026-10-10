import { describe, expect, it } from 'vitest';
import { LANDING_DESKTOP_POSITIONS, LANDING_PREVIEW_EDGES } from './LandingCanvasPreview';

describe('landing canvas preview layout', () => {
  it('keeps the chat architecture in separated reference lanes', () => {
    const p = LANDING_DESKTOP_POSITIONS;

    expect(p['api-gateway'].y).toBeLessThan(p['load-balancer'].y);
    expect(p.notification.x).toBeLessThan(p.chat.x);
    expect(p.postgres.x).toBe(p.chat.x);
    expect(p.postgres.y).toBeGreaterThan(p.chat.y);
    expect(p.redis.x).toBeGreaterThan(p.chat.x);
    expect(p.redis.y).toBeLessThan(p.chat.y);
    expect(p.broker.x).toBeGreaterThan(p.chat.x);
    expect(p.broker.y).toBeGreaterThan(p.chat.y);
    expect(p.presence.x).toBeGreaterThan(p.broker.x);
  });

  it('animates only async relationships so their dashes show flow direction', () => {
    const asyncEdges = LANDING_PREVIEW_EDGES.filter((edge) => edge.data?.isAsync === true);
    const syncEdges = LANDING_PREVIEW_EDGES.filter((edge) => edge.data?.isAsync !== true);

    expect(asyncEdges.length).toBeGreaterThan(0);
    expect(asyncEdges.every((edge) => edge.animated === true)).toBe(true);
    expect(syncEdges.every((edge) => edge.animated !== true)).toBe(true);
  });
});
