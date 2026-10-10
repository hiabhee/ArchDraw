import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({ auth: { api: { getSession: m.getSession } } }));
vi.mock('@/lib/server/prisma', () => ({
  default: { user: { findUnique: m.findUnique, updateMany: m.updateMany, update: vi.fn() } },
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimit: vi.fn(), RedisRateLimitError: class extends Error {} }));
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() } }));

import { checkAIGenerationQuota, getSessionFromRequest, releaseAIGeneration } from '../quotaCheck';

const req = () => new NextRequest('http://localhost/api/generate-diagram', { method: 'POST' });

describe('checkAIGenerationQuota (authenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getSession.mockResolvedValue({ user: { id: 'u1' } });
    m.findUnique.mockResolvedValue({ email: 'a@b.c', dailyGenerations: 3, dailyGenerationsDate: new Date() });
  });

  it('claims the slot with a conditional increment', async () => {
    m.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const result = await checkAIGenerationQuota(req());
    expect(result).toMatchObject({ allowed: true, claimedUserId: 'u1' });
    expect(m.updateMany.mock.calls[1][0]).toMatchObject({
      where: { id: 'u1', dailyGenerations: { lt: expect.any(Number) } },
      data: { dailyGenerations: { increment: 1 } },
    });
  });

  it('denies when the conditional increment matches no row (limit reached concurrently)', async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    const result = await checkAIGenerationQuota(req());
    expect(result.allowed).toBe(false);
    expect(result.claimedUserId).toBeUndefined();
  });

  it('resets and claims on the first request of a new day', async () => {
    m.updateMany.mockResolvedValueOnce({ count: 1 });
    const result = await checkAIGenerationQuota(req());
    expect(result).toMatchObject({ allowed: true, claimedUserId: 'u1' });
    expect(m.updateMany).toHaveBeenCalledTimes(1);
  });

  it('releases a claimed slot without going below zero', async () => {
    m.updateMany.mockResolvedValue({ count: 1 });
    await releaseAIGeneration('u1');
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', dailyGenerations: { gt: 0 } },
      data: { dailyGenerations: { decrement: 1 } },
    });
    m.updateMany.mockClear();
    await releaseAIGeneration(undefined);
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});

describe('getSessionFromRequest', () => {
  it('memoizes the auth lookup per request object', async () => {
    m.getSession.mockClear();
    m.getSession.mockResolvedValue(null);
    const r = req();
    await getSessionFromRequest(r);
    await getSessionFromRequest(r);
    expect(m.getSession).toHaveBeenCalledTimes(1);
    await getSessionFromRequest(req());
    expect(m.getSession).toHaveBeenCalledTimes(2);
  });
});
