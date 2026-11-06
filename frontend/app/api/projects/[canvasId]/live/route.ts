import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { auth } from '@/lib/server/auth';
import { queryLiveSessions, toLiveSession } from '@/lib/server/projects/liveSessions';
import { assignDistinctColors } from '@/lib/diagram/projects/liveActivity';
import { createWatchToken } from '@/lib/server/projects/watchLink';

export const runtime = 'nodejs';

function watchPath(canvasId: string, agenticProjectId: string) {
  const token = createWatchToken(canvasId, agenticProjectId);
  return token ? `/live/${encodeURIComponent(token)}` : null;
}

interface CanvasMeta {
  id: string;
  user_id: string;
  name: string;
  updated_at: Date;
  agentic_project_id: string | null;
  repository_remote: string | null;
  workspace_id: string | null;
  linked_checkouts: number;
  detail_updated_at: Date | null;
}

/**
 * Everything the panel needs about the canvas in one round trip: the canvas,
 * its agentic project, first workspace, and active agent links (one
 * credential per `link`d checkout). Polled every few seconds.
 */
async function canvasMeta(canvasId: string): Promise<CanvasMeta | null> {
  const rows = await prisma.$queryRaw<CanvasMeta[]>`
    SELECT c.id, c.user_id, c.name, c.updated_at, c.agentic_project_id, p.repository_remote,
      (SELECT w.id::text FROM agentic_workspaces w WHERE w.project_id = c.agentic_project_id ORDER BY w.created_at ASC LIMIT 1) AS workspace_id,
      (SELECT count(*)::int FROM agentic_credentials k
        WHERE k.project_id = c.agentic_project_id AND k.revoked_at IS NULL AND k.expires_at > now()) AS linked_checkouts,
      (SELECT d.updated_at FROM project_detail_maps d WHERE d.canvas_id = c.id) AS detail_updated_at
    FROM user_canvases c
    LEFT JOIN agentic_projects p ON p.id = c.agentic_project_id
    WHERE c.id = ${canvasId}`;
  return rows[0] ?? null;
}

/**
 * Live agent activity for the owner's project canvas, polled by the editor.
 * `?detail=<updatedAt ms the client has, or 0>` also returns the detailed map
 * when it is newer (the editor asks only while showing it).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const now = Date.now();
    // Independent reads, run together; sessions are only returned once
    // ownership is confirmed.
    const sessionsQuery = queryLiveSessions(canvasId, now);
    sessionsQuery.catch(() => {});
    const [session, canvas] = await Promise.all([
      auth.api.getSession({ headers: request.headers }),
      canvasMeta(canvasId),
    ]);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canvas || canvas.user_id !== userId) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });

    const rows = canvas.agentic_project_id ? await sessionsQuery : [];
    const sessions = assignDistinctColors(rows.map((row) => toLiveSession(row, now)));
    const detailUpdatedAt = canvas.detail_updated_at ? new Date(canvas.detail_updated_at).getTime() : null;
    const detailSince = Number(request.nextUrl.searchParams.get('detail') ?? NaN);
    const detail = detailUpdatedAt !== null && Number.isFinite(detailSince) && detailUpdatedAt > detailSince
      ? await prisma.projectDetailMap.findUnique({ where: { canvasId: canvas.id }, select: { nodes: true, edges: true } })
      : null;

    return NextResponse.json(
      {
        canvasId: canvas.id,
        canvasName: canvas.name,
        isProject: Boolean(canvas.agentic_project_id),
        agenticProjectId: canvas.agentic_project_id,
        workspaceId: canvas.workspace_id,
        repositoryRemote: canvas.repository_remote,
        canvasUpdatedAt: new Date(canvas.updated_at).getTime(),
        serverTime: now,
        linkedCheckouts: Number(canvas.linked_checkouts) || 0,
        // Read-only link anyone can open to watch the project (no sign-in).
        watchPath: canvas.agentic_project_id ? watchPath(canvas.id, canvas.agentic_project_id) : null,
        detailUpdatedAt,
        ...(detail ? { detail: { nodes: detail.nodes, edges: detail.edges, updatedAt: detailUpdatedAt } } : {}),
        sessions,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Project live GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
