import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseSubscriptionEvent, verifyWebhookSignature } from '../lemonsqueezy';

const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex');

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ meta: { event_name: 'subscription_created' } });
  it('accepts the HMAC of the exact body', () => {
    expect(verifyWebhookSignature(body, sign(body, 's3cret'), 's3cret')).toBe(true);
  });
  it('rejects a wrong secret, a changed body, a missing or malformed signature', () => {
    expect(verifyWebhookSignature(body, sign(body, 'other'), 's3cret')).toBe(false);
    expect(verifyWebhookSignature(body + ' ', sign(body, 's3cret'), 's3cret')).toBe(false);
    expect(verifyWebhookSignature(body, null, 's3cret')).toBe(false);
    expect(verifyWebhookSignature(body, 'not-hex', 's3cret')).toBe(false);
    expect(verifyWebhookSignature(body, '', 's3cret')).toBe(false);
  });
});

describe('parseSubscriptionEvent', () => {
  const payload = (over: Record<string, unknown> = {}, event = 'subscription_updated') => ({
    meta: { event_name: event, custom_data: { user_id: 'user_1' } },
    data: {
      id: '42',
      type: 'subscriptions',
      attributes: {
        status: 'active',
        customer_id: 7,
        variant_id: 99,
        user_email: 'a@b.co',
        renews_at: '2026-12-01T00:00:00.000000Z',
        ends_at: null,
        updated_at: '2026-11-01T10:00:00.000000Z',
        urls: { customer_portal: 'https://store.lemonsqueezy.com/billing' },
        ...over,
      },
    },
  });

  it('reads a subscription event into our fields', () => {
    const u = parseSubscriptionEvent(payload())!;
    expect(u).toMatchObject({ eventName: 'subscription_updated', userId: 'user_1', providerSubscriptionId: '42', providerCustomerId: '7', variantId: '99', status: 'active', email: 'a@b.co', endsAt: null });
    expect(u.renewsAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(u.portalUrl).toBe('https://store.lemonsqueezy.com/billing');
  });
  it('ignores events that are not subscription lifecycle events', () => {
    expect(parseSubscriptionEvent({ ...payload(), meta: { event_name: 'order_created' } })).toBeNull();
    expect(parseSubscriptionEvent({ meta: { event_name: 'subscription_created' }, data: { id: '1', type: 'orders', attributes: { status: 'x' } } })).toBeNull();
    expect(parseSubscriptionEvent(null)).toBeNull();
    expect(parseSubscriptionEvent({})).toBeNull();
  });
  it('needs an id and a status', () => {
    expect(parseSubscriptionEvent(payload({ status: undefined }))).toBeNull();
  });
  it('has no user id when the checkout carried none', () => {
    const p = payload();
    (p.meta as { custom_data?: unknown }).custom_data = undefined;
    expect(parseSubscriptionEvent(p)!.userId).toBeNull();
  });
});
