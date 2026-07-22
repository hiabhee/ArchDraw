import { NextRequest, NextResponse } from 'next/server';
import { validateAdminConfig } from '@/lib/env-validation';

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

export async function POST(req: NextRequest) {
  const adminConfig = validateAdminConfig();

  if (!adminConfig) {
    return NextResponse.json(
      { error: 'Admin authentication not configured.' },
      { status: 503 },
    );
  }

  const { passcode: ADMIN_PASSCODE, sessionSecret: SESSION_SECRET, userId: ADMIN_USER_ID } = adminConfig;

  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const rl = loginRateLimitMap.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    rl.count++;
  } else {
    loginRateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
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
    exp: Date.now() + 60 * 60 * 24,
  });
  const signature = await hmacSign(payload, SESSION_SECRET);
  const sessionValue = `${Buffer.from(payload).toString('base64url')}.${signature}`;

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', sessionValue, {
    maxAge: 60 * 60 * 24,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return response;
}
