import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest, getGuestId } from '@/lib/middleware/quotaCheck';
import { getUserTier, type UserTier } from '@/lib/userQuotas';
import { CREDIT_POLICY, type DetailLevel } from '@/lib/creditPolicy';

export { CREDIT_POLICY, type DetailLevel } from '@/lib/creditPolicy';

function periodStart(tier: UserTier): Date {
  return new Date(Date.now() - CREDIT_POLICY[tier].periodMs);
}

async function spentSince(tier: UserTier, userId: string | null, guestId: string | null) {
  const logs = await prisma.usageLog.findMany({
    where: {
      action: 'credit_consumed',
      createdAt: { gte: periodStart(tier) },
      ...(tier === 'authenticated' ? { userId: userId! } : { guestId: guestId! }),
    },
    select: { metadata: true },
  });
  return logs.reduce((total, log) => {
    const value = log.metadata && typeof log.metadata === 'object' && 'credits' in log.metadata
      ? Number((log.metadata as { credits?: unknown }).credits)
      : 0;
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export async function getCreditSnapshot(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id ?? null;
  const tier = getUserTier(userId);
  const guestId = tier === 'guest' ? (getGuestId(req) ?? 'unknown') : null;
  const spent = userId || guestId ? await spentSince(tier, userId, guestId) : 0;
  const allowance = CREDIT_POLICY[tier].allowance;
  return {
    tier,
    balance: Math.max(0, allowance - spent),
    allowance,
    costs: CREDIT_POLICY.costs,
    periodEndsAt: new Date(Date.now() + CREDIT_POLICY[tier].periodMs).toISOString(),
  };
}

export async function consumeCredits(
  req: NextRequest,
  detailLevel: DetailLevel,
  metadata: Record<string, unknown> = {},
) {
  const snapshot = await getCreditSnapshot(req);
  const credits = CREDIT_POLICY.costs[detailLevel];
  if (snapshot.balance < credits) {
    return { allowed: false as const, ...snapshot, required: credits };
  }

  const session = await getSessionFromRequest(req);
  const userId = session?.user?.id ?? null;
  const guestId = snapshot.tier === 'guest' ? (getGuestId(req) ?? 'unknown') : null;
  await prisma.usageLog.create({
    data: {
      userId,
      guestId,
      action: 'credit_consumed',
      metadata: { ...metadata, credits, detailLevel },
    },
  });
  return { allowed: true as const, ...snapshot, balance: snapshot.balance - credits, consumed: credits };
}
