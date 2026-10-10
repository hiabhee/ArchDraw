import { createHash } from 'node:crypto';
import { auth } from '@/lib/server/auth';
import prisma from '@/lib/server/prisma';

export interface AgenticPrincipal {
  userId: string;
  credentialId?: string;
}

export function hashAgenticSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Resolve either an authenticated browser session or a project-scoped agent
 * credential. A supplied but invalid Authorization header never falls back to
 * a browser cookie.
 */
export async function getAgenticPrincipal(
  request: Request,
  projectId: string,
): Promise<AgenticPrincipal | null> {
  const authorization = request.headers.get('authorization');

  if (authorization !== null) {
    const match = authorization.match(/^Bearer\s+(adp_[A-Za-z0-9_-]{43})$/);
    if (!match) return null;

    const credential = await prisma.agenticCredential.findFirst({
      where: {
        tokenHash: hashAgenticSecret(match[1]),
        projectId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, ownerId: true },
    });
    if (!credential) return null;

    const markedUsed = await prisma.agenticCredential.updateMany({
      where: { id: credential.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { lastUsedAt: new Date() },
    });
    if (markedUsed.count !== 1) return null;

    return { userId: credential.ownerId, credentialId: credential.id };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ? { userId: session.user.id } : null;
}
