import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import {
  BOUT_GAP_MS,
  HISTORY_LIMIT,
  HISTORY_RETENTION_MS,
  componentScope,
  mergeBoutFiles,
  type ComponentHistoryEntry,
  type ComponentHistoryKind,
  type EditGroup,
} from '@/lib/diagram/projects/componentHistory';

interface SessionRef {
  canvasId: string;
  sessionKey: string;
  sessionName: string | null;
}

export type OpenEditBouts = Map<string, { id: string; files: unknown }>;

const boutKey = (componentId: string, detailComponentId: string | null) =>
  `${componentId}\u0000${detailComponentId ?? ''}`;

/**
 * The open (still-extendable) edit bout of each component in the report, in one
 * query. Starts without waiting, so it can overlap the session lookup. Returns
 * null on failure: history is best effort and never fails the report.
 */
export async function readOpenEditBouts(
  canvasId: string,
  sessionKey: string,
  componentIds: readonly string[],
  now: Date,
): Promise<OpenEditBouts | null> {
  try {
    const open = await prisma.componentActivity.findMany({
      where: {
        canvasId,
        sessionKey,
        kind: 'edit',
        componentId: { in: [...componentIds] },
        lastAt: { gte: new Date(now.getTime() - BOUT_GAP_MS) },
      },
      orderBy: { lastAt: 'desc' },
      select: { id: true, componentId: true, detailComponentId: true, files: true },
    });
    const bouts: OpenEditBouts = new Map();
    for (const row of open) {
      const key = boutKey(row.componentId, row.detailComponentId);
      if (!bouts.has(key)) bouts.set(key, { id: row.id, files: row.files });
    }
    return bouts;
  } catch (error) {
    logger.warn('Component history: could not read open edit bouts', error);
    return null;
  }
}

/** Extend each component's open bout, or start one. Writes in parallel: one row per component. */
export async function writeEditBouts(
  openBouts: OpenEditBouts | null,
  session: SessionRef & { intent: string | null },
  groups: readonly EditGroup[],
  now: Date,
) {
  if (!openBouts || groups.length === 0) return;
  await Promise.all(groups.map(async (group) => {
    try {
      const current = openBouts.get(boutKey(group.componentId, group.detailComponentId));
      if (current) {
        await prisma.componentActivity.update({
          where: { id: current.id },
          data: {
            files: mergeBoutFiles(current.files, group.files),
            edits: { increment: group.files.length },
            lastAt: now,
            ...(session.intent ? { intent: session.intent } : {}),
            ...(session.sessionName ? { sessionName: session.sessionName } : {}),
          },
        });
      } else {
        await prisma.componentActivity.create({
          data: {
            canvasId: session.canvasId,
            componentId: group.componentId,
            detailComponentId: group.detailComponentId,
            sessionKey: session.sessionKey,
            sessionName: session.sessionName,
            kind: 'edit',
            intent: session.intent,
            files: mergeBoutFiles([], group.files),
            edits: group.files.length,
            startedAt: now,
            lastAt: now,
          },
        });
      }
    } catch (error) {
      logger.warn('Component history: could not record an edit bout', error);
    }
  }));
}

/** Read then write, for callers that have nothing else to overlap. */
export async function recordEditBouts(session: SessionRef & { intent: string | null }, groups: readonly EditGroup[], now: Date) {
  if (groups.length === 0) return;
  const open = await readOpenEditBouts(session.canvasId, session.sessionKey, groups.map((g) => g.componentId), now);
  await writeEditBouts(open, session, groups, now);
}

/** Components a session put on the map (published diagram change). */
export async function recordAddedComponents(session: SessionRef, componentIds: readonly string[], now: Date) {
  if (componentIds.length === 0) return;
  await prisma.componentActivity.createMany({
    data: componentIds.map((componentId) => ({
      canvasId: session.canvasId,
      componentId,
      sessionKey: session.sessionKey,
      sessionName: session.sessionName,
      kind: 'added',
      startedAt: now,
      lastAt: now,
    })),
  }).catch((error: unknown) => logger.warn('Component history: could not record added components', error));
}

export function pruneComponentHistory(canvasId: string, now: Date) {
  return prisma.componentActivity
    .deleteMany({ where: { canvasId, lastAt: { lt: new Date(now.getTime() - HISTORY_RETENTION_MS) } } })
    .catch((error: unknown) => logger.warn('Component history: prune failed', error));
}

/** Newest first, for a component and everything inside it (overview ids or detailed-map ids). */
export async function queryComponentHistory(
  canvasId: string,
  componentIds: readonly string[],
  { withFiles }: { withFiles: boolean },
): Promise<ComponentHistoryEntry[]> {
  const ids = [...componentIds];
  const rows = await prisma.componentActivity.findMany({
    where: { canvasId, OR: [{ componentId: { in: ids } }, { detailComponentId: { in: ids } }] },
    orderBy: { lastAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  return rows.map((row) => {
    const files = Array.isArray(row.files) ? row.files.filter((f): f is string => typeof f === 'string') : [];
    return {
      id: row.id,
      componentId: row.componentId,
      detailComponentId: row.detailComponentId,
      sessionKey: row.sessionKey,
      sessionName: row.sessionName,
      kind: row.kind as ComponentHistoryKind,
      intent: row.intent,
      files: withFiles ? files : [],
      fileCount: files.length,
      edits: row.edits,
      startedAt: row.startedAt.getTime(),
      lastAt: row.lastAt.getTime(),
    };
  });
}

/**
 * History for one component of a project canvas: on the overview a component
 * and everything inside it; on the detailed map, the part and its children.
 */
export async function componentHistoryFor(
  canvas: { id: string; nodes?: unknown },
  componentId: string,
  level: 'overview' | 'detail',
  options: { withFiles: boolean },
): Promise<ComponentHistoryEntry[]> {
  const nodes = level === 'detail'
    ? (await prisma.projectDetailMap.findUnique({ where: { canvasId: canvas.id }, select: { nodes: true } }))?.nodes
    : canvas.nodes ?? (await prisma.userCanvas.findUnique({ where: { id: canvas.id }, select: { nodes: true } }))?.nodes;
  const list = (Array.isArray(nodes) ? nodes : []) as Array<{ id: string; parentNode?: string | null; parentId?: string | null }>;
  if (!list.some((node) => node?.id === componentId)) return [];
  return queryComponentHistory(canvas.id, componentScope(list, componentId), options);
}

/** `?component=<id>&level=overview|detail` of a history request; null when invalid. */
export function parseHistoryQuery(params: URLSearchParams): { componentId: string; level: 'overview' | 'detail' } | null {
  const componentId = params.get('component')?.trim();
  if (!componentId || componentId.length > 200) return null;
  return { componentId, level: params.get('level') === 'detail' ? 'detail' : 'overview' };
}
