import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Lemon Squeezy: checkout creation and webhook parsing. Server-only. Nothing here
 * grants access: only a webhook whose signature verifies may write a subscription.
 */

const API = 'https://api.lemonsqueezy.com/v1';

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  variantId: string;
  webhookSecret: string;
}

/** Null until every variable is set, so billing stays off (and errors say why) in dev and CI. */
export function getLemonSqueezyConfig(): LemonSqueezyConfig | null {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY?.trim();
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID?.trim();
  const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID?.trim();
  const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim();
  if (!apiKey || !storeId || !variantId || !webhookSecret) return null;
  return { apiKey, storeId, variantId, webhookSecret };
}

/** `X-Signature` is the hex HMAC-SHA256 of the raw request body with the signing secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature.trim(), 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function createCheckoutUrl(
  cfg: LemonSqueezyConfig,
  input: { userId: string; email: string; name?: string | null; redirectUrl: string },
): Promise<string> {
  const res = await fetch(`${API}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: input.email,
            ...(input.name ? { name: input.name } : {}),
            // Comes back on every webhook for this purchase: how we know whose it is.
            custom: { user_id: input.userId },
          },
          product_options: { redirect_url: input.redirectUrl },
        },
        relationships: {
          store: { data: { type: 'stores', id: cfg.storeId } },
          variant: { data: { type: 'variants', id: cfg.variantId } },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Lemon Squeezy checkout failed (${res.status})`);
  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url) throw new Error('Lemon Squeezy returned no checkout URL');
  return url;
}

export interface SubscriptionUpdate {
  eventName: string;
  /** Our user id (from checkout `custom.user_id`), or null when the event doesn't carry one. */
  userId: string | null;
  email: string | null;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  variantId: string | null;
  status: string;
  renewsAt: Date | null;
  endsAt: Date | null;
  portalUrl: string | null;
  providerUpdatedAt: Date | null;
}

const date = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const text = (v: unknown): string | null => (typeof v === 'string' || typeof v === 'number' ? String(v) : null);

/** Subscription lifecycle events only; anything else (orders, licenses) returns null. */
export function parseSubscriptionEvent(payload: unknown): SubscriptionUpdate | null {
  const p = payload as {
    meta?: { event_name?: unknown; custom_data?: { user_id?: unknown } };
    data?: { id?: unknown; type?: unknown; attributes?: Record<string, unknown> };
  };
  const eventName = text(p?.meta?.event_name);
  if (!eventName?.startsWith('subscription_') || p?.data?.type !== 'subscriptions') return null;
  const id = text(p.data.id);
  const a = p.data.attributes ?? {};
  const status = text(a.status);
  if (!id || !status) return null;
  const urls = (a.urls ?? {}) as { customer_portal?: unknown };
  return {
    eventName,
    userId: text(p.meta?.custom_data?.user_id),
    email: text(a.user_email),
    providerSubscriptionId: id,
    providerCustomerId: text(a.customer_id),
    variantId: text(a.variant_id),
    status,
    renewsAt: date(a.renews_at),
    endsAt: date(a.ends_at),
    portalUrl: text(urls.customer_portal),
    providerUpdatedAt: date(a.updated_at),
  };
}
