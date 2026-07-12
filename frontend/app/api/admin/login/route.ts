import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '';
  const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

  if (!ADMIN_PASSCODE || !SESSION_SECRET) {
    return NextResponse.json(
      { error: 'Admin authentication not configured' },
      { status: 500 },
    );
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

  const success = body.passcode === ADMIN_PASSCODE;

  if (!success) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  const payload = JSON.stringify({
    sub: process.env.ADMIN_USER_ID || '',
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
