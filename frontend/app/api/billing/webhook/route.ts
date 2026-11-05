import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { getLemonSqueezyConfig, parseSubscriptionEvent, verifyWebhookSignature } from '@/lib/server/billing/lemonsqueezy';

export const runtime = 'nodejs';

/**
 * Lemon Squeezy webhook. The only writer of `Subscription`: it trusts nothing but
 * a body whose HMAC verifies, so a forged request or a browser redirect can never
 * grant a plan. Replies 200 for events it deliberately ignores so the provider
 * does not retry them.
 */
export async function POST(request: NextRequest) {
  const cfg = getLemonSqueezyConfig();
  if (!cfg) return NextResponse.json({ error: 'Billing is not configured', code: 'BILLING_NOT_CONFIGURED' }, { status: 503 });

  // The signature covers the exact bytes sent, so read the body as text before parsing.
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get('x-signature'), cfg.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update = parseSubscriptionEvent(payload);
  if (!update) return NextResponse.json({ ok: true, ignored: true });

  try {
    // Our id travels in the checkout's custom data; fall back to the buyer's email.
    let user = update.userId ? await prisma.user.findUnique({ where: { id: update.userId }, select: { id: true } }) : null;
    if (!user && update.email) user = await prisma.user.findUnique({ where: { email: update.email.toLowerCase() }, select: { id: true } });
    if (!user) {
      logger.warn(`[billing] ${update.eventName} for subscription ${update.providerSubscriptionId} matched no user`);
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Events can arrive out of order: skip one older than what we already applied.
    const existing = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { providerSubscriptionId: true, providerUpdatedAt: true },
    });
    if (
      existing &&
      existing.providerSubscriptionId === update.providerSubscriptionId &&
      existing.providerUpdatedAt &&
      update.providerUpdatedAt &&
      update.providerUpdatedAt <= existing.providerUpdatedAt
    ) {
      return NextResponse.json({ ok: true, stale: true });
    }

    const data = {
      provider: 'lemonsqueezy',
      providerSubscriptionId: update.providerSubscriptionId,
      providerCustomerId: update.providerCustomerId,
      variantId: update.variantId,
      status: update.status,
      renewsAt: update.renewsAt,
      endsAt: update.endsAt,
      portalUrl: update.portalUrl,
      providerUpdatedAt: update.providerUpdatedAt,
    };
    await prisma.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 500 makes the provider retry, which is what we want for a transient database error.
    logger.error('[billing] webhook failed', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
