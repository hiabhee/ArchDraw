import { auth } from '@/lib/server/auth';
import { getAgenticPrincipal } from '@/lib/server/agentic-auth';
import prisma from '@/lib/server/prisma';

/**
 * A project is a canvas linked to an AgenticProject; the agentic project only
 * anchors the existing `adp_` agent credentials and pairing flow.
 */
const projectCanvasSelect = {
  id: true,
  userId: true,
  name: true,
  nodes: true,
  edges: true,
  updatedAt: true,
  agenticProjectId: true,
  agenticProject: {
    select: {
      repositoryRemote: true,
      workspaces: { select: { id: true }, orderBy: { createdAt: 'asc' as const }, take: 1 },
    },
  },
} as const;

export async function findProjectCanvas(canvasId: string) {
  return prisma.userCanvas.findUnique({ where: { id: canvasId }, select: projectCanvasSelect });
}

export type ProjectCanvas = NonNullable<Awaited<ReturnType<typeof findProjectCanvas>>>;

/** Signed-in owner of the canvas (browser session). Null when not the owner. */
export async function getOwnedCanvas(request: Request, canvasId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return { userId: null, canvas: null };
  const canvas = await findProjectCanvas(canvasId);
  return { userId, canvas: canvas && canvas.userId === userId ? canvas : null };
}

/**
 * Resolve a coding agent (Bearer `adp_` credential) for a project canvas. The
 * credential must be scoped to the canvas's agentic project and belong to the
 * canvas owner. Browser sessions are rejected — these routes are agent-only.
 */
export async function authorizeAgentForCanvas(request: Request, canvasId: string) {
  if (!request.headers.get('authorization')) return null;
  const canvas = await findProjectCanvas(canvasId);
  if (!canvas?.agenticProjectId) return null;
  const principal = await getAgenticPrincipal(request, canvas.agenticProjectId);
  if (!principal?.credentialId || principal.userId !== canvas.userId) return null;
  return { canvas, principal };
}
