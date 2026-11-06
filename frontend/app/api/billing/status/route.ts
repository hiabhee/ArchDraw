import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/server/prisma';
import { getSessionFromRequest } from '@/lib/server/quotaCheck';
import { getLemonSqueezyConfig } from '@/lib/server/billing/lemonsqueezy';
import { getMaxProjects, getUserPlan } from '@/lib/server/billing/plan';

export const runtime = 'nodejs';

/** The signed-in user's plan, their live-project cap and, when subscribed, the provider's page to manage it. */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const userId = session?.user?.id ?? null;
  const billingEnabled = getLemonSqueezyConfig() !== null;
  if (!userId) return NextResponse.json({ plan: 'free', billingEnabled, maxProjects: await getMaxProjects(null), portalUrl: null });

  const [plan, maxProjects, sub] = await Promise.all([
    getUserPlan(userId),
    getMaxProjects(userId),
    prisma.subscription.findUnique({ where: { userId }, select: { portalUrl: true, status: true, renewsAt: true, endsAt: true } }),
  ]);
  return NextResponse.json({
    plan,
    billingEnabled,
    maxProjects,
    status: sub?.status ?? null,
    renewsAt: sub?.renewsAt ?? null,
    endsAt: sub?.endsAt ?? null,
    portalUrl: sub?.portalUrl ?? null,
  });
}
