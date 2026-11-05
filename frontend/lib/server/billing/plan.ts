import prisma from '@/lib/server/prisma';
import { getUserQuotas, getUserTier } from '@/lib/quotas/userQuotas';
import { maxProjectsFor, planFromSubscription, type Plan } from '@/lib/quotas/plans';

/** The user's plan, from their subscription row. Anonymous and guest ids are always free. */
export async function getUserPlan(userId: string | null | undefined): Promise<Plan> {
  if (!userId || getUserTier(userId) === 'guest') return 'free';
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { status: true, endsAt: true } });
  return planFromSubscription(sub);
}

/** Live projects this user may keep: the tier's cap, raised by a paid plan. */
export async function getMaxProjects(userId: string | null | undefined): Promise<number> {
  const base = getUserQuotas(getUserTier(userId)).maxProjects;
  return maxProjectsFor(base, await getUserPlan(userId));
}
