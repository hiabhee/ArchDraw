import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('@/lib/server/prisma', () => ({ default: db }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { POST } from '../webhook/route';

const SECRET = 'whsec_test';
const body = (over: Record<string, unknown> = {}, event = 'subscription_created') =>
  JSON.stringify({
    meta: { event_name: event, custom_data: { user_id: 'user_1' } },
    data: { id: '42', type: 'subscriptions', attributes: { status: 'active', customer_id: 1, variant_id: 2, updated_at: '2026-11-01T10:00:00Z', ...over } },
  });
const call = (raw: string, signature: string | null) =>
  POST(new Request('http://localhost/api/billing/webhook', { method: 'POST', body: raw, headers: signature ? { 'x-signature': signature } : {} }) as never);
const sign = (raw: string) => createHmac('sha256', SECRET).update(raw).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LEMON_SQUEEZY_API_KEY = 'k';
  process.env.LEMON_SQUEEZY_STORE_ID = '1';
  process.env.LEMON_SQUEEZY_VARIANT_ID = '2';
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
  db.user.findUnique.mockResolvedValue({ id: 'user_1' });
  db.subscription.findUnique.mockResolvedValue(null);
});

describe('POST /api/billing/webhook', () => {
  it('is off (503) until billing is configured', async () => {
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    expect((await call(body(), 'x')).status).toBe(503);
  });

  it('rejects an unsigned or wrongly signed request and writes nothing', async () => {
    expect((await call(body(), null)).status).toBe(401);
    expect((await call(body(), sign(body() + 'tampered'))).status).toBe(401);
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it('stores a verified subscription for the user named in the checkout', async () => {
    const raw = body();
    const res = await call(raw, sign(raw));
    expect(res.status).toBe(200);
    expect(db.subscription.upsert).toHaveBeenCalledTimes(1);
    const arg = db.subscription.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user_1' });
    expect(arg.create).toMatchObject({ userId: 'user_1', providerSubscriptionId: '42', status: 'active' });
  });

  it('ignores events that are not subscription events', async () => {
    const raw = JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: '1', type: 'orders', attributes: {} } });
    const res = await call(raw, sign(raw));
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it('ignores an event that matches no user', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const raw = body();
    expect((await call(raw, sign(raw))).status).toBe(200);
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it('skips a stale event that arrives after a newer one', async () => {
    db.subscription.findUnique.mockResolvedValue({ providerSubscriptionId: '42', providerUpdatedAt: new Date('2026-11-01T12:00:00Z') });
    const raw = body({ status: 'cancelled', updated_at: '2026-11-01T10:00:00Z' });
    expect(await (await call(raw, sign(raw))).json()).toMatchObject({ stale: true });
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it('returns 500 on a database error so the provider retries', async () => {
    db.subscription.upsert.mockRejectedValue(new Error('db down'));
    const raw = body();
    expect((await call(raw, sign(raw))).status).toBe(500);
  });
});
