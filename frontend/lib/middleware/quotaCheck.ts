import { NextRequest } from 'next/server';
import { getUserTier, getGuestQuotas, getAuthenticatedQuotas, type UserTier } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/redis';
import logger from '@/lib/logger';

export async function getSessionFromRequest(req: NextRequest) {
  try {
    return await auth.api.getSession({ headers: req.headers });
  } catch {
    return null;
  }
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

export async function checkAIGenerationQuota(
  req: NextRequest
): Promise<{ allowed: boolean; error?: string; remaining?: number; tier: UserTier }> {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id;
  const tier = getUserTier(userId);

  if (tier === 'guest') {
    const quotas = getGuestQuotas();
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Try Redis first, fall back to DB
    try {
      const result = await checkRateLimit(
        `guest-ai:${identifier}`,
        quotas.aiGenerationsPerHour,
        3600
      );
      if (result.allowed) {
        return { allowed: true, remaining: result.remaining, tier };
      }
      // Redis says denied — enforce it
      const authQuotas = getAuthenticatedQuotas();
      return {
        allowed: false,
        error: `Guest limit: ${quotas.aiGenerationsPerHour} generations per hour. Sign in for ${authQuotas.aiGenerationsPerDay}/day.`,
        remaining: 0,
        tier,
      };
    } catch {
      // Redis unavailable — fall back to DB tracking (fail-closed)
      logger.warn('[Quota] Redis unavailable, falling back to DB rate limit for guest');
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
    select: { dailyGenerations: true, dailyGenerationsDate: true },
  });

  if (!user) {
    return { allowed: false, error: 'User not found', tier };
  }

  const today = new Date().toDateString();
  const lastReset = new Date(user.dailyGenerationsDate).toDateString();

  if (today !== lastReset) {
    await prisma.user.update({
      where: { id: userId! },
      data: { dailyGenerations: 0, dailyGenerationsDate: new Date() },
    });
    return { allowed: true, remaining: quotas.aiGenerationsPerDay - 1, tier };
  }

  if (user.dailyGenerations >= quotas.aiGenerationsPerDay) {
    return {
      allowed: false,
      error: `Daily limit reached (${quotas.aiGenerationsPerDay} generations). Resets at midnight.`,
      remaining: 0,
      tier,
    };
  }

  return {
    allowed: true,
    remaining: quotas.aiGenerationsPerDay - user.dailyGenerations - 1,
    tier,
  };
}

export async function incrementAIGeneration(userId: string | null) {
  if (!userId || userId === 'guest') return;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyGenerations: { increment: 1 },
        totalGenerations: { increment: 1 },
      },
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
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
