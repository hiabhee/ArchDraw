import { NextRequest } from 'next/server';
import prisma from '@/lib/server/prisma';
import { getSessionFromRequest, getGuestId } from '@/lib/server/quotaCheck';
import { getUserTier, type UserTier } from '@/lib/quotas/userQuotas';
import { CREDIT_POLICY, type DetailLevel } from '@/lib/quotas/creditPolicy';

export { CREDIT_POLICY, type DetailLevel } from '@/lib/quotas/creditPolicy';

function periodStart(tier: UserTier): Date {
  return new Date(Date.now() - CREDIT_POLICY[tier].periodMs);
}

type CreditDb = Pick<typeof prisma, 'usageLog'>;

async function spentSince(tier: UserTier, userId: string | null, guestId: string | null, db: CreditDb = prisma) {
  const logs = await db.usageLog.findMany({
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
  let allowance = CREDIT_POLICY[tier].allowance;
  // Admin and granted credits (featureFlags.credits) — for jamdadeabhishek039@gmail.com
  if (userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, featureFlags: true } });
      const adminEmail = process.env.ALLOWED_ADMIN_EMAIL?.trim().toLowerCase();
      if (adminEmail && user?.email?.toLowerCase() === adminEmail) {
        // Admin gets effectively unlimited
        return {
          tier,
          balance: 999,
          allowance: 999,
          costs: CREDIT_POLICY.costs,
          periodEndsAt: new Date(Date.now() + CREDIT_POLICY[tier].periodMs).toISOString(),
          unlimited: true,
        };
      }
      const extra = (user?.featureFlags as Record<string, unknown> | null)?.credits;
      if (typeof extra === 'number' && Number.isFinite(extra) && extra > 0) {
        allowance += extra;
      }
    } catch {
      // ignore, fall back to base allowance
    }
  }
  return {
    tier,
    balance: Math.max(0, allowance - spent),
    allowance,
    unlimited: false,
    costs: CREDIT_POLICY.costs,
    periodEndsAt: new Date(Date.now() + CREDIT_POLICY[tier].periodMs).toISOString(),
  };
}

/**
 * Atomically reserve credits BEFORE running a generation.
 *
 * The balance read and the `credit_consumed` insert happen inside one
 * transaction holding a Postgres advisory lock keyed on the payer, so
 * concurrent requests from the same user/guest serialize instead of all
 * passing a stale balance check. Call `refundCredits(reservationId)` if the
 * generation fails so failures stay free.
 */
export async function reserveCredits(
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
  const lockKey = `credits:${userId ?? `guest:${guestId}`}`;
  // Spend granted on top of the base allowance (admin / featureFlags.credits)
  // is already folded into snapshot.balance; recompute only the spent part
  // under the lock.
  const allowance = snapshot.allowance;

  const reservation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const balance = snapshot.unlimited
      ? snapshot.balance
      : Math.max(0, allowance - await spentSince(snapshot.tier, userId, guestId, tx));
    if (balance < credits) return null;
    const log = await tx.usageLog.create({
      data: {
        userId,
        guestId,
        action: 'credit_consumed',
        metadata: { ...metadata, credits, detailLevel },
      },
      select: { id: true },
    });
    return { id: log.id, balance: balance - credits };
  });

  if (!reservation) {
    return { allowed: false as const, ...snapshot, balance: 0, required: credits };
  }
  return {
    allowed: true as const,
    ...snapshot,
    balance: reservation.balance,
    consumed: credits,
    reservationId: reservation.id,
  };
}

/** Undo a `reserveCredits` charge (generation failed or was aborted). */
export async function refundCredits(reservationId: string) {
  try {
    await prisma.usageLog.delete({ where: { id: reservationId } });
  } catch {
    // Already refunded / row missing — nothing to undo.
  }
}
