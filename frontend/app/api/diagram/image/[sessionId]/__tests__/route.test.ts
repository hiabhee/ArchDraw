import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rateLimit: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rateLimit }));
vi.mock('@/lib/server/prisma', () => ({ default: { sharedCanvas: { findUnique: m.find } } }));
vi.mock('@/lib/server/ip', () => ({ getClientIP: () => '203.0.113.7' }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';

const nodes = [
  { id: 'a', type: 'textLabelNode', position: { x: 0, y: 0 }, width: 200, height: 100, data: { text: 'Hello drawing' } },
  { id: 'b', type: 'shapeNode', position: { x: 0, y: 200 }, width: 200, height: 90, data: { label: '', shape: 'rounded-rectangle' } },
];
const call = (query = '', id = 'sess1') => GET(
  new NextRequest(`http://localhost/api/diagram/image/${id}${query}`),
  { params: Promise.resolve({ sessionId: id }) },
);
const now = () => Math.floor(Date.now() / 1000);

describe('GET /api/diagram/image/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: now() + 3600 });
    m.find.mockResolvedValue({ canvasName: 'My plan!', nodes, edges: [], expiresAt: new Date(Date.now() + 86_400_000), revision: 3 });
  });

  it('serves a PNG in the hand-drawn style by default, inline and cacheable', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="My-plan.png"');
    expect(response.headers.get('cache-control')).toMatch(/public/);
    expect(response.headers.get('etag')).toContain('sess1-3-sketch-light-on-png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  });

  it('serves SVG in the requested style and theme', async () => {
    const response = await call('?format=svg&style=studio&theme=dark');
    expect(response.headers.get('content-type')).toMatch(/svg/);
    const text = await response.text();
    expect(text).toContain('Hello drawing');
    expect(response.headers.get('etag')).toContain('studio-dark-on-svg');
  });

  it('rejects options it does not know', async () => {
    expect((await call('?format=gif')).status).toBe(400);
    expect((await call('?scale=99')).status).toBe(400);
    expect((await call('?style=glitter')).status).toBe(400);
    expect(m.find).not.toHaveBeenCalled();
  });

  it('answers 404 for a session that does not exist and 410 for one that expired', async () => {
    m.find.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(404);
    m.find.mockResolvedValueOnce({ canvasName: 'x', nodes, edges: [], expiresAt: new Date(Date.now() - 1000), revision: 1 });
    expect((await call()).status).toBe(410);
  });

  it('throttles by client address before touching the database', async () => {
    m.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: now() + 120 });
    const response = await call();
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(m.rateLimit).toHaveBeenCalledWith('diagram-image:ip:203.0.113.7', 120, 3600);
    expect(m.find).not.toHaveBeenCalled();
  });
});
