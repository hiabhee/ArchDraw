import { randomBytes, randomUUID } from 'node:crypto';
import type { Edge, Node } from 'reactflow';
import prisma from '@/lib/server/prisma';
import { hashAgenticSecret } from '@/lib/server/agentic-auth';
import { getUserQuotas, getUserTier } from '@/lib/quotas/userQuotas';
import { createAgenticProject } from '@/lib/server/projects/agenticProjects';
import { createClaimSecret, createWatchToken, verifyClaimSecret } from '@/lib/server/projects/watchLink';
import { ANONYMOUS_USER_PREFIX, isAnonymousUserId } from '@/lib/server/projects/anonymousUser';

export { isAnonymousUserId };

/**
 * Projects made without an account (`npx archdraw-live`). The canvas belongs
 * to a placeholder user (`anon_…`, no sign-in method, so nobody can log in as
 * it) until someone holding the claim secret signs in and takes it over.
 * Unclaimed, inactive projects are deleted by the daily cleanup cron.
 */

const ANONYMOUS_EMAIL_DOMAIN = 'anonymous.archdraw.invalid';
const CREDENTIAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface AnonymousProjectInput {
  name: string;
  nodes: Node[];
  edges: Edge[];
  repositoryRemote?: string | null;
  branch?: string | null;
}

export async function createAnonymousProject(input: AnonymousProjectInput) {
  const userId = `${ANONYMOUS_USER_PREFIX}${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: userId,
      name: 'Anonymous',
      email: `${userId}@${ANONYMOUS_EMAIL_DOMAIN}`,
      featureFlags: { anonymous: true },
    },
  });
  try {
    const project = await createAgenticProject(userId, {
      name: input.name,
      repositoryRemote: input.repositoryRemote ?? null,
      defaultBranch: input.branch ?? null,
    });
    const canvasId = randomUUID();
    const token = `adp_${randomBytes(32).toString('base64url')}`;
    await prisma.$transaction([
      prisma.userCanvas.create({
        data: {
          id: canvasId,
          userId,
          name: input.name,
          nodes: input.nodes as never,
          edges: input.edges as never,
          agenticProjectId: project.id,
        },
      }),
      prisma.agenticCredential.create({
        data: {
          ownerId: userId,
          projectId: project.id,
          name: 'ArchDraw quick start',
          tokenHash: hashAgenticSecret(token),
          expiresAt: new Date(Date.now() + CREDENTIAL_TTL_MS),
        },
      }),
    ]);
    const watchToken = createWatchToken(canvasId, project.id);
    const claimSecret = createClaimSecret(canvasId, project.id);
    return {
      canvasId,
      agenticProjectId: project.id,
      workspaceId: project.workspaces[0]?.id ?? null,
      token,
      watchPath: watchToken ? `/live/${encodeURIComponent(watchToken)}` : null,
      claimSecret,
    };
  } catch (error) {
    // Cascades to anything created above.
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    throw error;
  }
}

export type ClaimResult =
  | { ok: true; canvasId: string; alreadyOwned: boolean }
  | { ok: false; status: number; code: string; error: string };

/**
 * Move an anonymous project (canvas, agentic project and its agent
 * credentials) to a signed-in user. Credentials keep working, so the linked
 * checkout needs no new pairing.
 */
export async function claimAnonymousProject(userId: string, canvasId: string, claim: string): Promise<ClaimResult> {
  const canvas = await prisma.userCanvas.findUnique({
    where: { id: canvasId },
    select: { id: true, userId: true, agenticProjectId: true },
  });
  if (!canvas?.agenticProjectId) {
    return { ok: false, status: 404, code: 'NOT_FOUND', error: 'This project no longer exists.' };
  }
  if (canvas.userId === userId) return { ok: true, canvasId: canvas.id, alreadyOwned: true };
  if (!isAnonymousUserId(canvas.userId)) {
    return { ok: false, status: 409, code: 'ALREADY_CLAIMED', error: 'This project already belongs to an account.' };
  }
  if (!verifyClaimSecret(claim, canvas.id, canvas.agenticProjectId)) {
    return { ok: false, status: 403, code: 'INVALID_CLAIM', error: 'This link cannot save the project. Run the command again from your repository.' };
  }

  const { maxProjects } = getUserQuotas(getUserTier(userId));
  const existing = await prisma.userCanvas.count({ where: { userId, agenticProjectId: { not: null } } });
  if (existing >= maxProjects) {
    return {
      ok: false,
      status: 403,
      code: 'PROJECT_LIMIT_EXCEEDED',
      error: `Your plan allows ${maxProjects} live project${maxProjects === 1 ? '' : 's'}. Stop one in the editor, then try again.`,
    };
  }

  const anonymousId = canvas.userId;
  const projectId = canvas.agenticProjectId;
  const moved = await prisma.$transaction(async (tx) => {
    const updated = await tx.userCanvas.updateMany({ where: { id: canvas.id, userId: anonymousId }, data: { userId } });
    if (updated.count !== 1) return false; // claimed concurrently
    await tx.agenticProject.updateMany({ where: { id: projectId, ownerId: anonymousId }, data: { ownerId: userId } });
    await tx.agenticCredential.updateMany({ where: { projectId, ownerId: anonymousId }, data: { ownerId: userId } });
    await tx.user.delete({ where: { id: anonymousId } });
    return true;
  });
  if (!moved) return { ok: false, status: 409, code: 'ALREADY_CLAIMED', error: 'This project already belongs to an account.' };
  return { ok: true, canvasId: canvas.id, alreadyOwned: false };
}

/** Unclaimed projects with no canvas change or agent activity for this long are deleted. */
export const ANONYMOUS_PROJECT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function deleteStaleAnonymousProjects(now = new Date(), batchSize = 500): Promise<number> {
  const cutoff = new Date(now.getTime() - ANONYMOUS_PROJECT_TTL_MS);
  const stale = await prisma.user.findMany({
    where: {
      id: { startsWith: ANONYMOUS_USER_PREFIX },
      createdAt: { lt: cutoff },
      userCanvases: {
        none: { OR: [{ updatedAt: { gte: cutoff } }, { agentSessions: { some: { lastSeenAt: { gte: cutoff } } } }] },
      },
    },
    select: { id: true },
    take: batchSize,
  });
  if (stale.length === 0) return 0;
  const result = await prisma.user.deleteMany({
    where: { id: { in: stale.map((u) => u.id) }, AND: { id: { startsWith: ANONYMOUS_USER_PREFIX } } },
  });
  return result.count;
}
