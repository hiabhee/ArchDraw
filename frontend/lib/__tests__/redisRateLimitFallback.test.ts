import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env-validation', () => ({ validateRedisConfig: () => null }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { checkRateLimitWithFallback } from '@/lib/redis';

describe('checkRateLimitWithFallback', () => {
  it('still enforces a limit in memory when Redis is not configured', async () => {
    const key = `test:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push((await checkRateLimitWithFallback(key, 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
});
