import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getSessionFromRequest } from '@/lib/server/quotaCheck';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { getUserPlan } from '@/lib/server/billing/plan';
import { createCheckoutUrl, getLemonSqueezyConfig } from '@/lib/server/billing/lemonsqueezy';

export const runtime = 'nodejs';

/** Start a Pro checkout for the signed-in user. Returns the hosted checkout URL to send the browser to. */
export async function POST(request: NextRequest) {
  const cfg = getLemonSqueezyConfig();
  if (!cfg) return NextResponse.json({ error: 'Billing is not set up yet.', code: 'BILLING_NOT_CONFIGURED' }, { status: 503 });

  const session = await getSessionFromRequest(request);
  const user = session?.user;
  if (!user?.id || !user.email) return NextResponse.json({ error: 'Sign in to upgrade.' }, { status: 401 });

  const limit = await checkRateLimitWithFallback(`billing-checkout:${user.id}`, 10, 3600);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

  if ((await getUserPlan(user.id)) === 'pro') {
    return NextResponse.json({ error: 'You already have Pro. Manage it from the billing page.', code: 'ALREADY_PRO' }, { status: 409 });
  }

  // The return address is fixed server-side: never taken from the request.
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || request.nextUrl.origin).replace(/\/$/, '');
  try {
    const url = await createCheckoutUrl(cfg, { userId: user.id, email: user.email, name: user.name, redirectUrl: `${base}/dashboard?upgraded=1` });
    return NextResponse.json({ url });
  } catch (error) {
    logger.error('[billing] checkout failed', error);
    return NextResponse.json({ error: 'Could not start checkout. Try again.' }, { status: 502 });
  }
}
