import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';
import { validateRedisConfig } from '@/lib/env-validation';

/**
 * Upstash Redis client — initialized once, shared across all API routes.
 *
 * Cache invalidation:
 *   - Tutorial responses: no TTL (permanent). To clear after content updates,
 *     run `redis.flushdb()` or delete specific keys with `redis.del(key)`.
 *   - Free-text responses: 7-day TTL (604800s).
 *   - Shared canvas: 24-hour TTL (86400s).
 */

/**
 * Upstash Redis client — initialized conditionally.
 * If Redis is not configured or only partially configured, gracefully degrades
 * to a no-op client that logs warnings instead of silently failing.
 */
const createRedisClient = () => {
  try {
    const config = validateRedisConfig();
    
    if (!config) {
      // Redis not configured - return no-op client with logging
      logger.warn('[Redis] Not configured - using no-op client (caching disabled)');
      return {
        get: async () => { logger.debug('[Redis] Skipped GET (not configured)'); return null; },
        set: async () => { logger.debug('[Redis] Skipped SET (not configured)'); return null; },
        del: async () => { logger.debug('[Redis] Skipped DEL (not configured)'); return null; },
        flushdb: async () => { logger.debug('[Redis] Skipped FLUSHDB (not configured)'); return null; },
        multi: () => ({
          zremrangebyscore: () => {},
          zadd: () => {},
          zcard: () => {},
          expire: () => {},
          exec: async () => { throw new Error('Redis not configured'); },
        }),
        zremrangebyscore: async () => 0,
      } as unknown as Redis;
    }
    
    logger.info('[Redis] Successfully initialized');
    return new Redis({ url: config.url, token: config.token });
  } catch (error) {
    // Validation error - Redis misconfigured
    logger.error('[Redis] Configuration error:', error);
    throw error;
  }
};

export const redis = createRedisClient();

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

export class RedisRateLimitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RedisRateLimitError';
  }
}

export async function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = redisKeys.rateLimit(identifier);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  // NOTE: On any Redis failure (not configured, network error, timeout) we
  // *throw* RedisRateLimitError instead of returning `{ allowed: true }`.
  // Returning `allowed: true` made quota enforcement fail open — since Redis
  // is documented as optional, the default deployment granted unlimited free
  // Groq generations and defeated the guest quota entirely. Callers that have
  // a fail-closed fallback (quotaCheck's DB counter) catch this and apply it;
  // callers with no fallback catch this and degrade as they see fit.
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  multi.zcard(key);
  multi.expire(key, windowSeconds);

  // Set a reasonable timeout for Redis operations
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Redis operation timeout')), 3000); // 3 second timeout
  });

  let results: [number, number, number, number];
  try {
    results = await Promise.race([
      multi.exec<[number, number, number, number]>(),
      timeoutPromise,
    ]);
  } catch (error) {
    throw new RedisRateLimitError(
      error instanceof Error ? error.message : 'Redis rate limit check failed',
      error,
    );
  }

  const count = results[2] ?? 0;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const resetAt = now + windowSeconds;

  if (!allowed) {
    // Clean up old entries when rate limited
    try {
      await redis.zremrangebyscore(key, 0, windowStart);
    } catch (cleanupError) {
      // Cleanup failure is non-critical
      logger.debug('[RateLimit] Cleanup failed:', cleanupError);
    }
  }

  logger.debug(`[RateLimit] Check passed - count: ${count}, limit: ${limit}, allowed: ${allowed}`);
  return { allowed, remaining, resetAt };
}
