import { NextRequest, NextResponse } from 'next/server';
import { validateAdminConfig } from '@/lib/env-validation';
import { getClientIP } from '@/lib/server/ip';
import { trackAdminSession } from '@/lib/admin-session-tracking';
import { checkRateLimit } from '@/lib/redis';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBuffer = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);
  return Buffer.from(signature).toString('hex');
}

const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Fallback limiter used only when Redis is unavailable — per-instance.
function memoryRateLimit(ip: string, now: number): void {
  const rl = loginRateLimitMap.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return;
    }
    rl.count++;
  } else {
    loginRateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
  }
}

function memoryRateLimited(ip: string, now: number): boolean {
  const rl = loginRateLimitMap.get(ip);
  return Boolean(rl && now < rl.resetAt && rl.count >= 5);
}

export async function POST(req: NextRequest) {
  const adminConfig = validateAdminConfig();

  if (!adminConfig) {
    return NextResponse.json(
      { error: 'Admin authentication not configured.' },
      { status: 503 },
    );
  }

  const { passcode: ADMIN_PASSCODE, sessionSecret: SESSION_SECRET, userId: ADMIN_USER_ID } = adminConfig;

  // Rate limit: 5 attempts per real client IP per 15 minutes.
  // Key on the trusted-proxy-aware client IP — leftmost X-Forwarded-For is
  // client-controllable, so keying on it would let an attacker rotate the
  // header to bypass the 5-attempt admin passcode lockout.
  const ip = getClientIP(req);
  const now = Date.now();

  // Prefer Redis so the limit holds across restarts and replicas; fall back to
  // the in-memory limiter only when Redis is unavailable.
  let rateLimited: boolean;
  try {
    const rl = await checkRateLimit(`admin-login:${ip}`, 5, 15 * 60);
    rateLimited = !rl.allowed;
  } catch (error) {
    logger.warn('[AdminLogin] Redis rate limit unavailable, using in-memory limiter:', error);
    memoryRateLimit(ip, now);
    rateLimited = memoryRateLimited(ip, now);
  }

  if (rateLimited) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.passcode || typeof body.passcode !== 'string') {
    return NextResponse.json({ error: 'Passcode required' }, { status: 400 });
  }

  // Timing-safe comparison
  const encoder = new TextEncoder();
  const passcodeBuf = encoder.encode(body.passcode.padEnd(64, '\0'));
  const expectedBuf = encoder.encode(ADMIN_PASSCODE.padEnd(64, '\0'));
  let mismatch = 0;
  for (let i = 0; i < passcodeBuf.length; i++) {
    mismatch |= passcodeBuf[i] ^ expectedBuf[i];
  }
  const success = mismatch === 0 && body.passcode.length === ADMIN_PASSCODE.length;

  if (!success) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  const payload = JSON.stringify({
    sub: ADMIN_USER_ID || 'admin',
    exp: Date.now() + 60 * 60 * 24 * 1000,
  });
  const signature = await hmacSign(payload, SESSION_SECRET);
  const sessionValue = `${Buffer.from(payload).toString('base64url')}.${signature}`;

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', sessionValue, {
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
  
  // Track session IP and user agent for additional security (Redis-backed)
  const userAgent = req.headers.get('user-agent') || 'unknown';
  await trackAdminSession(sessionValue, ip, userAgent);
  
  return response;
}
