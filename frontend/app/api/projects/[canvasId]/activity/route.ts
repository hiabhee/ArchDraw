import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { type Prisma } from '@/src/generated/prisma/client';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { authorizeAgentForCanvas, readJsonBody } from '@/lib/server/projects/projectCanvas';
import { createComponentMatcher, normalizeRepoPath, type CodePathNode } from '@/lib/diagram/projects/pathMatcher';
import { actionForEvent, mergeTouched, mergeUnmapped, parseTouched, statusForEvent } from '@/lib/diagram/projects/liveActivity';
import { isAutoCanvasName } from '@/lib/diagram/canvas/canvasNames';
import { isSourcePath, siteAnchorFor, siteAreaFor } from '@/lib/diagram/projects/constructionSite';
import { pickSessionName } from '@/lib/server/projects/liveSessions';
import { groupEditsByComponent } from '@/lib/diagram/projects/componentHistory';
import { pruneComponentHistory, recordEditBouts } from '@/lib/server/projects/componentHistory';

export const runtime = 'nodejs';

/**
 * Coding-agent activity for a project canvas. Receives repository-relative
 * file paths only — never file contents, diffs or prompts.
 */
const activitySchema = z.object({
  sessionKey: z.string().trim().min(1).max(200),
  /** read: the agent read/searched files (moves its figure, does not count as an edit). aim: componentIds the task points at. wait: asked for permission. */
  event: z.enum(['start', 'read', 'edit', 'aim', 'wait', 'stop', 'end']),
  files: z.array(z.string().max(1024)).max(50).optional(),
  componentIds: z.array(z.string().max(200)).max(50).optional(),
  label: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(255).optional(),
  intent: z.string().trim().max(280).optional(),
  /** Folder name of the linked repository; names an auto-named project canvas. */
  repoName: z.string().trim().min(1).max(120).regex(/^[^\u0000-\u001f]+$/).optional(),
});

const ACTIVITY_LIMIT_PER_MINUTE = 600;
const MAX_ACTIVITY_BYTES = 64 * 1024;
/** Sessions are kept this long; the live panel shows only the last hours. */
const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const agent = await authorizeAgentForCanvas(request, canvasId);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // The detailed map (if drawn) places the session on a module, not just a component.
    const detailQuery = prisma.projectDetailMap
      .findUnique({ where: { canvasId: agent.canvas.id }, select: { nodes: true } })
      .catch(() => null);

    const rate = await checkRateLimitWithFallback(
      `project-activity:${agent.principal.credentialId}`,
      ACTIVITY_LIMIT_PER_MINUTE,
      60,
    );
    if (!rate.allowed) return NextResponse.json({ error: 'Too many activity events' }, { status: 429 });

    const raw = await readJsonBody(request, MAX_ACTIVITY_BYTES);
    if (raw.tooLarge) return NextResponse.json({ error: 'Activity payload too large' }, { status: 413 });
    const parsed = activitySchema.safeParse(raw.value);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid activity payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const nodes = (Array.isArray(agent.canvas.nodes) ? agent.canvas.nodes : []) as unknown as CodePathNode[];
    const nodeIds = new Set(nodes.map((n) => n.id));
    const matcher = createComponentMatcher(nodes);

    const mapped: Record<string, string> = {};
    const unmapped: string[] = [];
    for (const raw of body.files ?? []) {
      const path = normalizeRepoPath(raw);
      if (!path) continue;
      const componentId = matcher.match(path);
      if (componentId) mapped[path] = componentId;
      else unmapped.push(path);
    }
    const knownComponentIds = (body.componentIds ?? []).filter((id) => nodeIds.has(id));
    const isRead = body.event === 'read';
    const isAim = body.event === 'aim';
    // Edits count on the component (badges); reads and aims only move the figure.
    const touchedIds = isRead || isAim ? [] : [...Object.values(mapped), ...knownComponentIds];
    const locatedAt = isRead ? Object.values(mapped).at(-1) : touchedIds.at(-1);
    const aimComponentId = isAim ? knownComponentIds[0] : undefined;
    const action = actionForEvent(body.event);
    const isEdit = body.event === 'edit' && (body.files?.length ?? 0) > 0;
    // Coverage counts edited source files; reading docs or config is not work on a component.
    const mappedHits = isEdit ? Object.keys(mapped).filter(isSourcePath).length : 0;
    const unmappedHits = isEdit ? unmapped.filter(isSourcePath).length : 0;
    // Editing new code outside the map: a construction site at its folder.
    const lastEdited = isEdit ? normalizeRepoPath(body.files!.at(-1)!) : null;
    const siteArea = lastEdited && !mapped[lastEdited] ? siteAreaFor(lastEdited, nodes) : null;

    // Where on the detailed map: the most specific part that owns the file.
    let detailComponentId: string | null | undefined;
    let detailOf: ((path: string) => string | null) | undefined;
    if (locatedAt || isEdit) {
      const detail = await detailQuery;
      const detailNodes = (Array.isArray(detail?.nodes) ? detail.nodes : []) as unknown as CodePathNode[];
      if (detailNodes.length > 0) {
        const detailMatcher = createComponentMatcher(detailNodes);
        detailOf = (path) => detailMatcher.match(path) || null;
        const located = Object.keys(mapped).at(-1);
        if (locatedAt) detailComponentId = (located && detailOf(located)) || null;
      }
    }

    const now = new Date();
    const key = { canvasId_sessionKey: { canvasId: agent.canvas.id, sessionKey: body.sessionKey } };
    // Read-modify-write of one session row. A session's start and first edit
    // can arrive together (hooks deliver in the background): both may try to
    // create the row, so a unique-key race retries once against the winner.
    const writeSession = async () => {
      const existing = await prisma.agentSession.findUnique({
        where: key,
        select: { touched: true, unmappedPaths: true, currentComponentId: true, name: true },
      });
      const name = existing?.name ?? (await pickSessionName(agent.canvas.id, body.sessionKey, now.getTime()));
      // An edit on the map leaves any site; an edit of new code moves to (or stays at) its site.
      const siteFields = !isEdit
        ? {}
        : siteArea
          ? { siteArea, siteAnchorId: siteAnchorFor(siteArea, nodes, existing?.currentComponentId ?? null) }
          : Object.keys(mapped).length > 0
            ? { siteArea: null, siteAnchorId: null }
            : {};
      const touched = mergeTouched(parseTouched(existing?.touched), touchedIds, now.getTime()) as unknown as Prisma.InputJsonObject;
      // Files read outside the map are normal exploration, not "unmapped" work.
      const unmappedPaths = isRead ? mergeUnmapped(existing?.unmappedPaths, []) : mergeUnmapped(existing?.unmappedPaths, unmapped);
      const currentComponentId = locatedAt ?? existing?.currentComponentId ?? null;
      const status = statusForEvent(body.event);
      const actionFields = {
        ...(detailComponentId !== undefined ? { detailComponentId } : {}),
        ...(action ? { lastAction: action, lastActionAt: now } : {}),
        ...(aimComponentId ? { aimComponentId } : {}),
      };

      return prisma.agentSession.upsert({
        where: key,
        create: {
          canvasId: agent.canvas.id,
          sessionKey: body.sessionKey,
          label: body.label || body.branch || 'Agent session',
          branch: body.branch ?? null,
          status,
          intent: body.intent ?? null,
          currentComponentId,
          touched,
          unmappedPaths,
          lastSeenAt: now,
          name,
          mappedHits,
          unmappedHits,
          ...siteFields,
          ...actionFields,
        },
        update: {
          ...(body.label ? { label: body.label } : {}),
          ...(body.branch ? { branch: body.branch } : {}),
          ...(body.intent ? { intent: body.intent } : {}),
          status,
          currentComponentId,
          touched,
          unmappedPaths,
          lastSeenAt: now,
          ...(existing?.name ? {} : { name }),
          ...(mappedHits ? { mappedHits: { increment: mappedHits } } : {}),
          ...(unmappedHits ? { unmappedHits: { increment: unmappedHits } } : {}),
          ...siteFields,
          ...actionFields,
        },
        select: { id: true, name: true, intent: true },
      });
    };
    let session;
    try {
      session = await writeSession();
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      session = await writeSession();
    }

    // Component history: who worked on what, and why (edits on the map only).
    if (isEdit && Object.keys(mapped).length > 0) {
      await recordEditBouts(
        { canvasId: agent.canvas.id, sessionKey: body.sessionKey, sessionName: session.name, intent: session.intent },
        groupEditsByComponent(mapped, detailOf),
        now,
      );
    }

    if (body.event === 'start' && body.repoName && isAutoCanvasName(agent.canvas.name)) {
      // Name the canvas after its repository. Raw SQL so updated_at stays put:
      // bumping it would turn an edit the user is saving into a false conflict.
      // The editor picks the name up from the live snapshot.
      await prisma.$executeRaw`UPDATE user_canvases SET name = ${body.repoName} WHERE id = ${agent.canvas.id} AND name = ${agent.canvas.name}`;
    }

    if (body.event === 'start') {
      // Each agent session adds a row; drop old ones so the table stays bounded.
      await prisma.agentSession.deleteMany({
        where: { canvasId: agent.canvas.id, lastSeenAt: { lt: new Date(now.getTime() - SESSION_RETENTION_MS) } },
      });
      await pruneComponentHistory(agent.canvas.id, now);
    }

    return NextResponse.json({ ok: true, sessionId: session.id, name: session.name, mapped, unmapped });
  } catch (error) {
    logger.error('Project activity POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
