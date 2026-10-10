import { NextRequest } from 'next/server';
import { getUserTier, getGuestQuotas, getAuthenticatedQuotas, type UserTier } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkRateLimit, RedisRateLimitError } from '@/lib/redis';
import { getClientIP } from '@/lib/server/ip';
import logger from '@/lib/logger';

// Per-request memo. React `cache()` only dedupes inside a Server Component
// render, so in route handlers it re-ran the auth lookup on every call.
const sessionByRequest = new WeakMap<NextRequest, ReturnType<typeof loadSession>>();

async function loadSession(req: NextRequest) {
  try {
    return await auth.api.getSession({ headers: req.headers });
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest) {
  let pending = sessionByRequest.get(req);
  if (!pending) {
    pending = loadSession(req);
    sessionByRequest.set(req, pending);
  }
  return pending;
}

/**
 * DB-based fallback rate limiter for guests when Redis is unavailable.
 * Counts ai_generation usage_log entries for the given guest IP in the last hour.
 */
async function checkGuestQuotaViaDB(
  identifier: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const oneHourAgo = new Date(Date.now() - 3600_000);
  const count = await prisma.usageLog.count({
    where: {
      guestId: identifier,
      action: 'ai_generation',
      createdAt: { gte: oneHourAgo },
    },
  });
  const allowed = count < limit;
  const remaining = Math.max(0, limit - count);
  return { allowed, remaining };
}

// Admin accounts (ALLOWED_ADMIN_EMAIL) bypass the AI-generation limit entirely.
const ADMIN_EMAIL = process.env.ALLOWED_ADMIN_EMAIL?.trim().toLowerCase() || null;
const ADMIN_UNLIMITED_REMAINING = 999;

export async function checkAIGenerationQuota(
  req: NextRequest
): Promise<{ allowed: boolean; error?: string; remaining?: number; tier: UserTier; claimedUserId?: string }> {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id;
  const tier = getUserTier(userId);

  if (tier === 'guest') {
    const quotas = getGuestQuotas();
    // Use the trusted-proxy-aware client IP. The previous behaviour — the
    // leftmost X-Forwarded-For value — is client-controlled, so attackers
    // could rotate it to bypass the guest quota entirely.
    const identifier = getClientIP(req);
    const rateLimitKey = `guest-ai:${identifier}`;

    // Try Redis first, fall back to DB (fail-closed when both are unavailable).
    try {
      const result = await checkRateLimit(
        rateLimitKey,
        quotas.aiGenerationsPerHour,
        3600,
      );
      if (result.allowed) {
        return { allowed: true, remaining: result.remaining, tier };
      }
      const authQuotas = getAuthenticatedQuotas();
      return {
        allowed: false,
        error: `Guest limit: ${quotas.aiGenerationsPerHour} generations per hour. Sign in for ${authQuotas.aiGenerationsPerDay}/day.`,
        remaining: 0,
        tier,
      };
    } catch (error) {
      // checkRateLimit throws on any Redis failure (not configured, timeout,
      // network error). Fall through to the DB-based fail-closed counter so
      // the guest quota is still enforced — Redis being optional must not
      // imply unlimited free generations.
      if (!(error instanceof RedisRateLimitError)) {
        logger.error('[Quota] Unexpected error from checkRateLimit:', error);
      } else {
        logger.warn('[Quota] Redis unavailable, falling back to DB rate limit for guest');
      }
      try {
        const dbResult = await checkGuestQuotaViaDB(identifier, quotas.aiGenerationsPerHour);
        if (dbResult.allowed) {
          return { allowed: true, remaining: dbResult.remaining, tier };
        }
        const authQuotas = getAuthenticatedQuotas();
        return {
          allowed: false,
          error: `Guest limit: ${quotas.aiGenerationsPerHour} generations per hour. Sign in for ${authQuotas.aiGenerationsPerDay}/day.`,
          remaining: 0,
          tier,
        };
      } catch (dbError) {
        logger.error('[Quota] DB fallback also failed, denying guest request:', dbError);
        return { allowed: false, error: 'Quota check unavailable. Please try again.', remaining: 0, tier };
      }
    }
  }

  const quotas = getAuthenticatedQuotas();

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { email: true, dailyGenerations: true, dailyGenerationsDate: true },
  });

  if (!user) {
    return { allowed: false, error: 'User not found', tier };
  }

  if (ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL) {
    return { allowed: true, remaining: ADMIN_UNLIMITED_REMAINING, tier };
  }

  // Claim the slot atomically at check time. A read-then-increment-later
  // check let N concurrent requests all pass with one slot left. Callers must
  // `releaseAIGeneration(claimedUserId)` if the generation fails so failures
  // stay free.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const reset = await prisma.user.updateMany({
    where: { id: userId!, dailyGenerationsDate: { lt: startOfToday } },
    data: { dailyGenerations: 1, dailyGenerationsDate: new Date() },
  });
  if (reset.count === 1) {
    return { allowed: true, remaining: quotas.aiGenerationsPerDay - 1, tier, claimedUserId: userId! };
  }

  const claimed = await prisma.user.updateMany({
    where: { id: userId!, dailyGenerations: { lt: quotas.aiGenerationsPerDay } },
    data: { dailyGenerations: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return {
      allowed: false,
      error: `Daily limit reached (${quotas.aiGenerationsPerDay} generations). Resets at midnight.`,
      remaining: 0,
      tier,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, quotas.aiGenerationsPerDay - user.dailyGenerations - 1),
    tier,
    claimedUserId: userId!,
  };
}

/** Give back a daily slot claimed by `checkAIGenerationQuota` (generation failed). */
export async function releaseAIGeneration(claimedUserId: string | undefined) {
  if (!claimedUserId) return;
  try {
    await prisma.user.updateMany({
      where: { id: claimedUserId, dailyGenerations: { gt: 0 } },
      data: { dailyGenerations: { decrement: 1 } },
    });
  } catch (error) {
    logger.error('[Quota] Failed to release AI generation slot:', error);
  }
}

export async function incrementAIGeneration(userId: string | null) {
  if (!userId || userId === 'guest') return;
  try {
    // dailyGenerations is claimed atomically in checkAIGenerationQuota.
    await prisma.user.update({
      where: { id: userId },
      data: { totalGenerations: { increment: 1 } },
    });
  } catch (error) {
    logger.error('[Quota] Failed to increment AI generation:', error);
  }
}

export async function logUsage(
  userId: string | null,
  guestId: string | null,
  action: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.usageLog.create({
      data: {
        userId,
        guestId,
        action,
        metadata: (metadata || {}) as Record<string, string>,
      },
    });
  } catch (error) {
    logger.error('[Usage Log] Failed to log action:', error);
  }
}

export function getGuestId(req: NextRequest): string | null {
  const ip = getClientIP(req);
  return ip === 'unknown' ? null : ip;
}
