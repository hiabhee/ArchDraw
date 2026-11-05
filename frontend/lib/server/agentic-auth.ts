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
const LAST_USED_PRECISION_MS = 60_000;

/**
 * A live (unrevoked, unexpired) agent credential for a token, or null. Pass
 * `projectId` to require the credential to belong to that project; leave it out
 * to look up the project afterwards (lets the caller run both lookups at once).
 */
export async function findAgenticCredential(secret: string, projectId?: string) {
  return prisma.agenticCredential.findFirst({
    where: {
      tokenHash: hashAgenticSecret(secret),
      ...(projectId ? { projectId } : {}),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, ownerId: true, projectId: true, lastUsedAt: true },
  });
}

/**
 * Record use of a credential. Hooks call this on every edit; a minute's precision
 * is plenty and saves a write round trip per request. Returns false when the
 * credential was revoked or expired in the meantime.
 */
export async function markAgenticCredentialUsed(
  credential: { id: string; lastUsedAt: Date | null },
  now: number,
): Promise<boolean> {
  if (credential.lastUsedAt && now - credential.lastUsedAt.getTime() <= LAST_USED_PRECISION_MS) return true;
  const marked = await prisma.agenticCredential.updateMany({
    where: { id: credential.id, revokedAt: null, expiresAt: { gt: new Date(now) } },
    data: { lastUsedAt: new Date(now) },
  });
  return marked.count === 1;
}

export async function getAgenticPrincipal(
  request: Request,
  projectId: string,
): Promise<AgenticPrincipal | null> {
  const authorization = request.headers.get('authorization');

  if (authorization !== null) {
    const match = authorization.match(/^Bearer\s+(adp_[A-Za-z0-9_-]{43})$/);
    if (!match) return null;

    const credential = await findAgenticCredential(match[1], projectId);
    if (!credential) return null;
    if (!(await markAgenticCredentialUsed(credential, Date.now()))) return null;

    return { userId: credential.ownerId, credentialId: credential.id };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ? { userId: session.user.id } : null;
}
