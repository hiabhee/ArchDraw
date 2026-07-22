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
          exec: async () => [0, 0, 0, 0] as [number, number, number, number],
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

export async function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = redisKeys.rateLimit(identifier);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  try {
    // Test if Redis is actually available by attempting the operation
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    multi.zcard(key);
    multi.expire(key, windowSeconds);
    
    // Set a reasonable timeout for Redis operations
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Redis operation timeout')), 3000); // 3 second timeout
    });
    
    const results = await Promise.race([
      multi.exec<[number, number, number, number]>(),
      timeoutPromise
    ]);

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
  } catch (error) {
    // Redis operation failed - allow request with warning (graceful degradation)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[RateLimit] Redis error (graceful degradation): ${errorMessage}`);
    
    // Return permissive result to allow the request through
    return { allowed: true, remaining: limit, resetAt: now + windowSeconds };
  }
}
