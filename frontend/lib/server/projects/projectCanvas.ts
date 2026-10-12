import { auth } from '@/lib/server/auth';
import { getAgenticPrincipal } from '@/lib/server/agentic-auth';
import prisma from '@/lib/server/prisma';

/**
 * A project is a canvas linked to an AgenticProject; the agentic project only
 * anchors the existing `adp_` agent credentials and pairing flow.
 */
/**
 * Owner routes (make/stop project, live polling) never read the graph; the
 * nodes/edges JSON is the bulk of the row and is left out.
 */
const projectCanvasSelect = {
  id: true,
  userId: true,
  name: true,
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

/**
 * Agent routes need the graph but not the project's relations: one query, no
 * joins — every agent hook call pays for it.
 */
const agentCanvasSelect = {
  id: true,
  userId: true,
  name: true,
  nodes: true,
  edges: true,
  updatedAt: true,
  agenticProjectId: true,
} as const;

/** Signed-in owner of the canvas (browser session). Null when not the owner. */
export async function getOwnedCanvas(request: Request, canvasId: string) {
  // Independent lookups: run them together (each is a database round trip).
  const [session, canvas] = await Promise.all([
    auth.api.getSession({ headers: request.headers }),
    findProjectCanvas(canvasId),
  ]);
  const userId = session?.user?.id;
  if (!userId) return { userId: null, canvas: null };
  return { userId, canvas: canvas && canvas.userId === userId ? canvas : null };
}

/**
 * Resolve a coding agent (Bearer `adp_` credential) for a project canvas. The
 * credential must be scoped to the canvas's agentic project and belong to the
 * canvas owner. Browser sessions are rejected — these routes are agent-only.
 */
export async function authorizeAgentForCanvas(request: Request, canvasId: string) {
  if (!request.headers.get('authorization')) return null;
  const canvas = await prisma.userCanvas.findUnique({ where: { id: canvasId }, select: agentCanvasSelect });
  if (!canvas?.agenticProjectId) return null;
  const principal = await getAgenticPrincipal(request, canvas.agenticProjectId);
  if (!principal?.credentialId || principal.userId !== canvas.userId) return null;
  return { canvas, principal };
}

/**
 * Parse a JSON body no larger than `maxBytes`. Agent routes are reachable with
 * a long-lived token, so an oversized body must be refused before it is
 * parsed or stored. `value` is null for malformed JSON (callers validate).
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ tooLarge: true } | { tooLarge: false; value: unknown }> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return { tooLarge: true };
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) return { tooLarge: true };
  try {
    return { tooLarge: false, value: JSON.parse(text) };
  } catch {
    return { tooLarge: false, value: null };
  }
}
