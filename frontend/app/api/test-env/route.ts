import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * Diagnostic endpoint for OAuth / auth-secret presence.
 *
 * SECURITY: This route previously leaked the first 10 characters of
 * BETTER_AUTH_SECRET and the full OAuth config map, unauthenticated. It is
 * now gated behind the admin session (verified HMAC cookie) and returns only
 * boolean presence flags — never raw secret material — regardless of caller.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    return NextResponse.json({
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
      hasGithubSecret: !!process.env.GITHUB_CLIENT_SECRET,
      hasBetterAuthSecret: !!process.env.BETTER_AUTH_SECRET,
      betterAuthSecretLength: process.env.BETTER_AUTH_SECRET?.length ?? 0,
      betterAuthUrl: process.env.BETTER_AUTH_URL ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    });
  } catch (error) {
    logger.error('Test env error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}