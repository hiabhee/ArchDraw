import prisma from '@/lib/server/prisma';
import { parseStructureChange } from '@/lib/diagram/projects/structureDiff';
import { siteLabel } from '@/lib/diagram/projects/constructionSite';
import {
  ENDED_AFTER_MS,
  deriveSessionStatus,
  sessionNameFor,
  parseTouched,
  sessionColor,
  type AgentSessionStatus,
  type LiveAgentSession,
  type SessionAction,
} from '@/lib/diagram/projects/liveActivity';

const ACTIONS = new Set<SessionAction>(['start', 'read', 'run', 'edit', 'waiting', 'done']);

/** Sessions seen within this window are returned (ended ones included, for context). */
export const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Recent agent sessions of a project canvas (query starts immediately). */
export function queryLiveSessions(canvasId: string, now: number) {
  return prisma.agentSession.findMany({
    where: { canvasId, lastSeenAt: { gt: new Date(now - LIVE_WINDOW_MS) } },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
  });
}

type SessionRow = Awaited<ReturnType<typeof queryLiveSessions>>[number];

export function toLiveSession(row: SessionRow, now: number): LiveAgentSession {
  return {
    id: row.id,
    sessionKey: row.sessionKey,
    label: row.label,
    branch: row.branch,
    status: deriveSessionStatus(row.status as AgentSessionStatus, row.lastSeenAt.getTime(), now),
    intent: row.intent,
    currentComponentId: row.currentComponentId,
    touched: parseTouched(row.touched),
    unmappedPaths: Array.isArray(row.unmappedPaths) ? row.unmappedPaths.filter((p): p is string => typeof p === 'string') : [],
    startedAt: row.startedAt.getTime(),
    lastSeenAt: row.lastSeenAt.getTime(),
    color: sessionColor(row.sessionKey),
    lastChange: parseStructureChange(row.lastChange),
    lastAction: row.lastAction && ACTIONS.has(row.lastAction as SessionAction) ? (row.lastAction as SessionAction) : null,
    lastActionAt: row.lastActionAt ? row.lastActionAt.getTime() : null,
    aimComponentId: row.aimComponentId ?? null,
    name: row.name ?? sessionNameFor(row.sessionKey),
    site: row.siteArea ? { key: row.siteArea, label: siteLabel(row.siteArea), anchorId: row.siteAnchorId ?? null } : null,
    mappedHits: row.mappedHits,
    unmappedHits: row.unmappedHits,
    detailComponentId: row.detailComponentId ?? null,
  };
}

/** A name no other live session on the canvas uses (for a new session). */
export async function pickSessionName(canvasId: string, sessionKey: string, now = Date.now()): Promise<string> {
  const live = await prisma.agentSession.findMany({
    where: { canvasId, status: { not: 'ended' }, lastSeenAt: { gt: new Date(now - ENDED_AFTER_MS) }, name: { not: null } },
    select: { name: true },
    take: 200,
  });
  return sessionNameFor(sessionKey, new Set(live.map((r) => r.name!)));
}
