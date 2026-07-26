import type { NextRequest } from 'next/server';
import logger from '@/lib/logger';

/**
 * Secure client-IP resolution.
 *
 * Why this exists: reading the *leftmost* value of the `X-Forwarded-For`
 * header for rate limiting / identity is unsafe — that value is the one most
 * easily spoofed by the client. A client that rotates it resets every
 * per-IP counter (admin passcode lockout, AI generation quota, embed throttle,
 * tutorial-chat limits). This module resolves the *real* client IP using
 * platform-trusted, sanitized headers first, then falls back to trusted-proxy
 * aware parsing of `X-Forwarded-For`.
 *
 * Trusted-proxy model
 *   X-Forwarded-For is appended to on every hop:
 *     `client, proxyA, proxyB, ...`
 *   The rightmost entries are the proxies we trust (the TLS-terminating edge
 *   that we actually connect to). The client IP is the entry immediately to
 *   the *left* of those trusted hops. `TRUSTED_PROXIES_COUNT` (env) controls
 *   how many rightmost entries to strip; it defaults to 1 (a single platform
 *   edge, e.g. the Vercel/Cloudflare/nginx hop in front of the app).
 *
 * Platform-trusted headers (listed in order of preference) are set by the
 * hosting edge and are not client-controllable, so they are preferred when
 * present. They are still validated as well-formed IPs before use.
 */

const MAX_IP_LENGTH = 64;

// Accepts IPv4 dotted-quad and a permissive subset of IPv6 (hex + colons).
const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{0,4}){1,7})$/;

function isValidIP(value: string | undefined | null): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_IP_LENGTH &&
    IP_RE.test(value)
  );
}

function firstValidIp(value: string | undefined | null): string | null {
  if (!value) return null;
  // Headers can be comma-separated chains — take the first well-formed entry.
  for (const raw of value.split(',')) {
    const token = raw.trim();
    if (isValidIP(token)) return token;
  }
  return null;
}

function trustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXIES_COUNT;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 16) return parsed;
  // Default: one trusting hop — the single edge (Vercel/Cloudflare/nginx) in
  // front of the app that appends the real client IP to X-Forwarded-For.
  return 1;
}

/**
 * Resolve the real client IP for a request. Never returns the empty string;
 * falls back to the sentinel 'unknown' when no trustworthy IP can be derived
 * (callers should still apply their limits against 'unknown' so unidentified
 * traffic shares a single bucket rather than being unlimited).
 */
export function getClientIP(req: NextRequest): string {
  const headers = req.headers;

  // 1. Platform-trusted, sanitized headers (cannot be spoofed by the client).
  const platformHeaders = [
    'x-vercel-forwarded-for', // Vercel — sanitized, contains the real client IP only
    'cf-connecting-ip',       // Cloudflare
    'fly-client-ip',          // Fly.io
    'true-client-ip',         // Cloudflare Enterprise / Akamai
  ];
  for (const name of platformHeaders) {
    const ip = firstValidIp(headers.get(name));
    if (ip) return ip;
  }

  // 2. Trusted-proxy-aware parsing of X-Forwarded-For.
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const proxies = trustedProxyCount();
      // Client IP sits `proxies` entries to the left of the rightmost hop.
      let clientIndex = hops.length - proxies - 1;
      if (clientIndex < 0) clientIndex = 0;
      const candidate = hops[clientIndex]?.trim();
      if (isValidIP(candidate)) return candidate;
      // The hop at the computed index is malformed — walk leftward to a valid one.
      for (let i = clientIndex - 1; i >= 0; i--) {
        const ip = hops[i]?.trim();
        if (isValidIP(ip)) return ip;
      }
    }
  }

  // 3. Single-value proxy headers.
  const singleHeaders = ['x-real-ip', 'cf-connecting-ip'];
  for (const name of singleHeaders) {
    const ip = firstValidIp(headers.get(name));
    if (ip) return ip;
  }

  logger.debug('[getClientIP] No trustworthy client IP header present');
  return 'unknown';
}