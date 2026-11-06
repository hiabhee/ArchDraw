import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('@/lib/server/redis', () => ({ redis }));
vi.mock('@/lib/server/env-validation', () => ({ validateRedisConfig: () => true }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn() } }));

const snapshot = { diagram: { nodes: [], edges: [] }, checkpoints: [] };

describe('mcpWorkingSessionStore', () => {
  beforeEach(() => {
    vi.resetModules();
    redis.get.mockReset();
    redis.set.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('gives up on a hung Redis quickly and keeps the session in memory', async () => {
    const { mcpWorkingSessionStore: store } = await import('../sessionStore');
    redis.set.mockReturnValue(new Promise(() => {}));
    const save = store.save('a', snapshot as never);
    await vi.advanceTimersByTimeAsync(1_500);
    await save;
    await expect(store.load('a')).resolves.toEqual(snapshot);
  });

  it('skips Redis for a while after a failure', async () => {
    const { mcpWorkingSessionStore: store } = await import('../sessionStore');
    redis.get.mockRejectedValue(new Error('ENOTFOUND'));
    await store.load('a');
    await store.load('b');
    await store.save('c', snapshot as never);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_001);
    redis.get.mockResolvedValue(snapshot);
    await expect(store.load('d')).resolves.toEqual(snapshot);
    expect(redis.get).toHaveBeenCalledTimes(2);
  });
});
