import { NextRequest } from 'next/server';
import { validateAdminConfig } from '@/lib/env-validation';
import { auth } from '@/lib/auth';

const ALLOWED_ADMIN_EMAIL = process.env.ALLOWED_ADMIN_EMAIL || 'jamdadeabhishek039@gmail.com';

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBuffer = Uint8Array.from(Buffer.from(signature, 'hex'));
  const dataBuffer = encoder.encode(data);
  return crypto.subtle.verify('HMAC', key, sigBuffer, dataBuffer);
}

export async function verifyAdminSession(req: NextRequest): Promise<boolean> {
  const adminConfig = validateAdminConfig();
  if (!adminConfig) return false;

  const sessionCookie = req.cookies.get('admin_session')?.value;
  if (!sessionCookie) return false;

  const dotIndex = sessionCookie.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const payload = sessionCookie.slice(0, dotIndex);
  const signature = sessionCookie.slice(dotIndex + 1);

  try {
    const valid = await hmacVerify(payload, signature, adminConfig.sessionSecret);
    if (!valid) return false;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!decoded.exp || Date.now() > decoded.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  // First try the HMAC admin_session cookie
  const ok = await verifyAdminSession(req);
  if (ok) return null;

  // Fallback: check better-auth session for the allowed admin email
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.email === ALLOWED_ADMIN_EMAIL) {
      return null;
    }
  } catch {
    // Silently fall through to 401
  }

  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
