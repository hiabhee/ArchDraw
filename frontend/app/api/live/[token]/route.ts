import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { getClientIP } from '@/lib/server/ip';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { queryLiveSessions, toLiveSession } from '@/lib/server/projects/liveSessions';
import { assignDistinctColors } from '@/lib/diagram/projects/liveActivity';
import { parseWatchToken, verifyWatchToken } from '@/lib/server/projects/watchLink';
import { isAnonymousUserId } from '@/lib/server/projects/anonymousUser';
import { auth } from '@/lib/server/auth';

export const runtime = 'nodejs';

/** Watchers poll every few seconds; leave room for several tabs per IP. */
const WATCH_REQUESTS_PER_MINUTE = 120;

const notFound = () => NextResponse.json({ error: 'This live project link is invalid or was stopped.' }, { status: 404 });

/** Code paths map components to the owner's files; watchers only see the diagram. */
function publicNodes(nodes: unknown): unknown[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => {
    const n = node as { data?: Record<string, unknown> };
    if (!n?.data || !('codePaths' in n.data)) return node;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { codePaths, ...data } = n.data;
    return { ...n, data };
  });
}

/**
 * Public, read-only view of a live project (no sign-in): the diagram and which
 * agent session is working where. Unmapped file paths and code paths are left
 * out. `?since=<updatedAt>` skips the graph when it has not changed;
 * `?detail=<updatedAt or 0>` adds the detailed map when it is newer;
 * `?viewer=1` (first load only) says whether the signed-in visitor owns it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const rate = await checkRateLimitWithFallback(`live-watch:${getClientIP(request)}`, WATCH_REQUESTS_PER_MINUTE, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const parsed = parseWatchToken(token);
    if (!parsed) return notFound();
    const now = Date.now();
    const sessionsQuery = queryLiveSessions(parsed.canvasId, now);
    sessionsQuery.catch(() => {}); // awaited below only for a valid link
    const canvas = await prisma.userCanvas.findUnique({
      where: { id: parsed.canvasId },
      select: {
        id: true, userId: true, name: true, nodes: true, edges: true, updatedAt: true, agenticProjectId: true,
        detailMap: { select: { updatedAt: true } },
      },
    });
    if (!canvas?.agenticProjectId || !verifyWatchToken(token, canvas.id, canvas.agenticProjectId)) return notFound();

    // Only on the page's first load: the session lookup is a database read.
    const viewer = request.nextUrl.searchParams.has('viewer')
      ? await auth.api.getSession({ headers: request.headers }).catch(() => null)
      : null;
    const since = Number(request.nextUrl.searchParams.get('since'));
    const updatedAt = canvas.updatedAt.getTime();
    const detailUpdatedAt = canvas.detailMap?.updatedAt.getTime() ?? null;
    const detailSince = Number(request.nextUrl.searchParams.get('detail') ?? NaN);
    const detail = detailUpdatedAt !== null && Number.isFinite(detailSince) && detailUpdatedAt > detailSince
      ? await prisma.projectDetailMap.findUnique({ where: { canvasId: canvas.id }, select: { nodes: true, edges: true } })
      : null;
    const sessions = assignDistinctColors((await sessionsQuery).map((row) => {
      const session = toLiveSession(row, now);
      // Watchers see where new code is being built, not its folder path.
      const site = session.site ? { ...session.site, key: createHash('sha256').update(session.site.key).digest('base64url').slice(0, 12), label: 'new code' } : null;
      return { ...session, unmappedPaths: [], site };
    }));

    return NextResponse.json(
      {
        canvasName: canvas.name,
        // Made with `npx archdraw-live` and not saved to an account yet.
        claimable: isAnonymousUserId(canvas.userId),
        ...(request.nextUrl.searchParams.has('viewer') ? { ownedByViewer: Boolean(viewer?.user?.id && viewer.user.id === canvas.userId) } : {}),
        canvasUpdatedAt: updatedAt,
        detailUpdatedAt,
        serverTime: now,
        sessions,
        ...(detail
          ? { detail: { nodes: publicNodes(detail.nodes), edges: Array.isArray(detail.edges) ? detail.edges : [], updatedAt: detailUpdatedAt } }
          : {}),
        ...(Number.isFinite(since) && since >= updatedAt
          ? {}
          : { nodes: publicNodes(canvas.nodes), edges: Array.isArray(canvas.edges) ? canvas.edges : [] }),
      },
      { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
    );
  } catch (error) {
    logger.error('Live watch GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
