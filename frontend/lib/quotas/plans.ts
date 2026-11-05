/**
 * Paid plans. Pure (no I/O), so client and server agree on what a status means.
 * Plans raise limits on top of the signed-in tier in `userQuotas.ts`; they never
 * lower one.
 */

export type Plan = 'free' | 'pro';

/** Live projects a Pro subscriber can keep (the free tier's cap is in `userQuotas.ts`). */
export const PRO_MAX_PROJECTS = 10;

/** Lemon Squeezy statuses that keep Pro on. `past_due` is a grace period while the card is retried. */
const PRO_STATUSES = new Set(['on_trial', 'active', 'past_due']);

export function planFromSubscription(sub: { status: string; endsAt?: Date | string | null } | null | undefined, now: number = Date.now()): Plan {
  if (!sub) return 'free';
  if (PRO_STATUSES.has(sub.status)) return 'pro';
  // A cancelled subscription stays paid until the period it already paid for ends.
  if (sub.status === 'cancelled' && sub.endsAt) {
    const ends = new Date(sub.endsAt).getTime();
    return Number.isFinite(ends) && ends > now ? 'pro' : 'free';
  }
  return 'free';
}

export function maxProjectsFor(baseMaxProjects: number, plan: Plan): number {
  return plan === 'pro' ? Math.max(baseMaxProjects, PRO_MAX_PROJECTS) : baseMaxProjects;
}
