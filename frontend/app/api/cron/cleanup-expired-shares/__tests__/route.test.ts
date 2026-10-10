import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ findMany: vi.fn(), deleteMany: vi.fn() }));
vi.mock('@/lib/server/prisma', () => ({ default: { sharedCanvas: { findMany: m.findMany, deleteMany: m.deleteMany } } }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';

const req = (auth?: string) => new NextRequest('http://localhost/api/cron/cleanup-expired-shares', {
  headers: auth ? { authorization: auth } : {},
});

describe('GET /api/cron/cleanup-expired-shares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 's3cret');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects missing or wrong secrets', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer nope'))).status).toBe(401);
    expect(m.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(req('Bearer '))).status).toBe(401);
  });

  it('deletes expired shares in batches until none remain', async () => {
    const batch = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: `id-${offset + i}` }));
    m.findMany.mockResolvedValueOnce(batch(500)).mockResolvedValueOnce(batch(20, 500));
    m.deleteMany.mockResolvedValueOnce({ count: 500 }).mockResolvedValueOnce({ count: 20 });

    const res = await GET(req('Bearer s3cret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 520 });
    expect(m.findMany.mock.calls[0][0].where.expiresAt.lt).toBeInstanceOf(Date);
    expect(m.deleteMany).toHaveBeenCalledTimes(2);
  });
});
