import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { type Prisma } from '@/src/generated/prisma/client';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { authorizeAgentForCanvas } from '@/lib/server/projects/projectCanvas';
import { createComponentMatcher, normalizeRepoPath, type CodePathNode } from '@/lib/diagram/projects/pathMatcher';
import { mergeTouched, mergeUnmapped, parseTouched, statusForEvent } from '@/lib/diagram/projects/liveActivity';

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
});

const ACTIVITY_LIMIT_PER_MINUTE = 600;

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

    const parsed = activitySchema.safeParse(await request.json().catch(() => null));
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
    const existing = await prisma.agentSession.findUnique({ where: key, select: { touched: true, unmappedPaths: true, currentComponentId: true } });
    const touched = mergeTouched(parseTouched(existing?.touched), touchedIds, now.getTime()) as unknown as Prisma.InputJsonObject;
    const unmappedPaths = mergeUnmapped(existing?.unmappedPaths, unmapped);
    const currentComponentId = touchedIds.at(-1) ?? existing?.currentComponentId ?? null;
    const status = statusForEvent(body.event);

    const session = await prisma.agentSession.upsert({
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

    return NextResponse.json({ ok: true, sessionId: session.id, mapped, unmapped });
  } catch (error) {
    logger.error('Project activity POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
