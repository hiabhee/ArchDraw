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

/**
 * Extend the session's current bout on each component, or start one. Best
 * effort: history must never fail an activity report.
 */
export async function recordEditBouts(session: SessionRef & { intent: string | null }, groups: readonly EditGroup[], now: Date) {
  for (const group of groups) {
    try {
      const current = await prisma.componentActivity.findFirst({
        where: {
          canvasId: session.canvasId,
          sessionKey: session.sessionKey,
          componentId: group.componentId,
          detailComponentId: group.detailComponentId,
          kind: 'edit',
          lastAt: { gte: new Date(now.getTime() - BOUT_GAP_MS) },
        },
        orderBy: { lastAt: 'desc' },
        select: { id: true, files: true },
      });
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
  }
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
