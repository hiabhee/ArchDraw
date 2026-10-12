import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { type Prisma } from '@/src/generated/prisma/client';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { authorizeAgentForCanvas, readJsonBody } from '@/lib/server/projects/projectCanvas';
import { createComponentMatcher, normalizeRepoPath, type CodePathNode } from '@/lib/diagram/projects/pathMatcher';
import { mergeTouched, mergeUnmapped, parseTouched, statusForEvent } from '@/lib/diagram/projects/liveActivity';
import { isAutoCanvasName } from '@/lib/diagram/canvas/canvasNames';

export const runtime = 'nodejs';

/**
 * Coding-agent activity for a project canvas. Receives repository-relative
 * file paths only — never file contents, diffs or prompts.
 */
const activitySchema = z.object({
  sessionKey: z.string().trim().min(1).max(200),
  event: z.enum(['start', 'edit', 'stop', 'end']),
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
    const touchedIds = [
      ...Object.values(mapped),
      ...(body.componentIds ?? []).filter((id) => nodeIds.has(id)),
    ];

    const now = new Date();
    const key = { canvasId_sessionKey: { canvasId: agent.canvas.id, sessionKey: body.sessionKey } };
    // Read-modify-write of one session row. A session's start and first edit
    // can arrive together (hooks deliver in the background): both may try to
    // create the row, so a unique-key race retries once against the winner.
    const writeSession = async () => {
      const existing = await prisma.agentSession.findUnique({ where: key, select: { touched: true, unmappedPaths: true, currentComponentId: true } });
      const touched = mergeTouched(parseTouched(existing?.touched), touchedIds, now.getTime()) as unknown as Prisma.InputJsonObject;
      const unmappedPaths = mergeUnmapped(existing?.unmappedPaths, unmapped);
      const currentComponentId = touchedIds.at(-1) ?? existing?.currentComponentId ?? null;
      const status = statusForEvent(body.event);

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
        },
        select: { id: true },
      });
    };
    let session;
    try {
      session = await writeSession();
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      session = await writeSession();
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
    }

    return NextResponse.json({ ok: true, sessionId: session.id, mapped, unmapped });
  } catch (error) {
    logger.error('Project activity POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
