import { NextRequest, NextResponse } from 'next/server';
import { getUserTier, getGuestQuotas, getAuthenticatedQuotas } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';
import { getSessionFromRequest, getGuestId } from '@/lib/middleware/quotaCheck';
import { checkRateLimit } from '@/lib/redis';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id;
  const tier = getUserTier(userId);

  if (tier === 'guest') {
    const quotas = getGuestQuotas();
    const identifier = getGuestId(req) || 'unknown';
    let used = 0;
    try {
      const result = await checkRateLimit(`guest-ai:${identifier}`, quotas.aiGenerationsPerHour, 3600);
      used = quotas.aiGenerationsPerHour - result.remaining;
    } catch {
      // Redis unavailable — fall back to DB
      const oneHourAgo = new Date(Date.now() - 3600_000);
      try {
        used = await prisma.usageLog.count({
          where: {
            guestId: identifier,
            action: 'ai_generation',
            createdAt: { gte: oneHourAgo },
          },
        });
      } catch {
        used = 0;
      }
    }

    return NextResponse.json({
      tier,
      aiGenerations: {
        used,
        limit: quotas.aiGenerationsPerHour,
        window: 'hour' as const,
      },
      canvases: {
        current: 1,
        limit: quotas.maxCanvases,
      },
    });
  }

  const quotas = getAuthenticatedQuotas();

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: {
      dailyGenerations: true,
      dailyGenerationsDate: true,
      totalGenerations: true,
      _count: { select: { userCanvases: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ tier, error: 'User not found' }, { status: 404 });
  }

  const today = new Date().toDateString();
  const lastReset = new Date(user.dailyGenerationsDate).toDateString();
  const dailyUsed = today === lastReset ? user.dailyGenerations : 0;

  return NextResponse.json({
    tier,
    aiGenerations: {
      used: dailyUsed,
      limit: quotas.aiGenerationsPerDay,
      window: 'day' as const,
      total: user.totalGenerations,
    },
    canvases: {
      current: user._count.userCanvases,
      limit: quotas.maxCanvases,
    },
  });
}
