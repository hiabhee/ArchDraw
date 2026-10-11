import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { getOwnedCanvas } from '@/lib/server/projects/projectCanvas';
import { parseStructureChange } from '@/lib/diagram/projects/structureDiff';
import { deriveSessionStatus, parseTouched, sessionColor, type AgentSessionStatus } from '@/lib/diagram/projects/liveActivity';

export const runtime = 'nodejs';

/** Sessions seen within this window are returned (ended ones included, for context). */
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Live agent activity for the owner's project canvas, polled by the editor. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const { userId, canvas } = await getOwnedCanvas(request, canvasId);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canvas) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });

    const now = Date.now();
    const rows = canvas.agenticProjectId
      ? await prisma.agentSession.findMany({
          where: { canvasId: canvas.id, lastSeenAt: { gt: new Date(now - LIVE_WINDOW_MS) } },
          orderBy: { lastSeenAt: 'desc' },
          take: 50,
        })
      : [];

    const sessions = rows.map((row) => ({
      id: row.id,
      sessionKey: row.sessionKey,
      label: row.label,
      branch: row.branch,
      status: deriveSessionStatus(row.status as AgentSessionStatus, row.lastSeenAt.getTime(), now),
      intent: row.intent,
      currentComponentId: row.currentComponentId,
      touched: parseTouched(row.touched),
      unmappedPaths: Array.isArray(row.unmappedPaths) ? row.unmappedPaths : [],
      startedAt: row.startedAt.getTime(),
      lastSeenAt: row.lastSeenAt.getTime(),
      color: sessionColor(row.sessionKey),
      lastChange: parseStructureChange(row.lastChange),
    }));

    return NextResponse.json(
      {
        canvasId: canvas.id,
        isProject: Boolean(canvas.agenticProjectId),
        agenticProjectId: canvas.agenticProjectId,
        workspaceId: canvas.agenticProject?.workspaces[0]?.id ?? null,
        repositoryRemote: canvas.agenticProject?.repositoryRemote ?? null,
        canvasUpdatedAt: canvas.updatedAt.getTime(),
        serverTime: now,
        sessions,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Project live GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
