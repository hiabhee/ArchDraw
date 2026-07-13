import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

/**
 * Upstash Redis client — initialized once, shared across all API routes.
 *
 * Cache invalidation:
 *   - Tutorial responses: no TTL (permanent). To clear after content updates,
 *     run `redis.flushdb()` or delete specific keys with `redis.del(key)`.
 *   - Free-text responses: 7-day TTL (604800s).
 *   - Shared canvas: 24-hour TTL (86400s).
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Upstash Redis client — initialized conditionally.
 * During static build phases where credentials might be missing,
 * this prevents initialization warnings from the SDK.
 */
export const redis = url && token 
  ? new Redis({ url, token })
  : {
      get: async () => null,
      set: async () => null,
      del: async () => null,
      flushdb: async () => null,
    } as unknown as Redis;

// ── Key builders ──────────────────────────────────────────────────────────────

export const redisKeys = {
  tutorialPhase: (tutorialId: string, step: number, phase: string, explainCount: number) =>
    `tutorial:${tutorialId}:step:${step}:phase:${phase}:explain:${explainCount}`,

  tutorialWrong: (tutorialId: string, step: number) =>
    `tutorial:${tutorialId}:step:${step}:wrong`,

  tutorialFreeText: (questionHash: string, tutorialId: string, step: number) =>
    `tutorial:freetext:${questionHash}:${tutorialId}:${step}`,

  sharedCanvas: (shareId: string) =>
    `canvas:shared:${shareId}`,

  rateLimit: (identifier: string) =>
    `ratelimit:diagram:${identifier}`,
};

export async function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = redisKeys.rateLimit(identifier);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  try {
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    multi.zcard(key);
    multi.expire(key, windowSeconds);
    const results = await multi.exec<[number, number, number, number]>();

    const count = results[2] ?? 0;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = now + windowSeconds;

    if (!allowed) {
      await redis.zremrangebyscore(key, 0, windowStart);
    }

    return { allowed, remaining, resetAt };
  } catch (error) {
    logger.error('[RateLimit] Redis error, allowing request:', error);
    return { allowed: true, remaining: limit, resetAt: now + windowSeconds };
  }
}
