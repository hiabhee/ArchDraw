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

export async function checkAIGenerationQuota(
  req: NextRequest
): Promise<{ allowed: boolean; error?: string; remaining?: number; tier: UserTier }> {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id;
  const tier = getUserTier(userId);

  if (tier === 'guest') {
    const quotas = getGuestQuotas();
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    try {
      const result = await checkRateLimit(
        `guest-ai:${identifier}`,
        quotas.aiGenerationsPerHour,
        3600
      );
      const authQuotas = getAuthenticatedQuotas();
      return {
        allowed: result.allowed,
        error: result.allowed ? undefined : `Guest limit: ${quotas.aiGenerationsPerHour} generations per hour. Sign in for ${authQuotas.aiGenerationsPerDay}/day.`,
        remaining: result.remaining,
        tier,
      };
    } catch {
      return { allowed: true, remaining: quotas.aiGenerationsPerHour, tier };
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
