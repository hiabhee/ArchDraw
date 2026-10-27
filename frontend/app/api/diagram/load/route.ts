import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/server/prisma';
import logger from '@/lib/logger';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';
import { isDomainSuccess } from '@/lib/diagram/pipeline-core';
import { getUserTier, canAccessFeature } from '@/lib/quotas/userQuotas';
import { getSessionFromRequest, logUsage } from '@/lib/server/quotaCheck';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { getClientIP } from '@/lib/server/ip';

export const runtime = 'nodejs';

export interface ShareUser {
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

// Abuse throttles for the unauthenticated write path (MCP publishes by
// default, so every generation can create a row). Per user when signed in,
// otherwise per trusted-proxy client IP. Hourly windows.
const LOAD_RATE_LIMITS = {
  create: { anonymous: 30, user: 60 },
  preview: { anonymous: 300, user: 300 },
  update: { anonymous: 300, user: 300 },
} as const;
type LoadRequestKind = keyof typeof LOAD_RATE_LIMITS;

const PREVIEW_BACKGROUND = '#fdfdfc';

async function rateLimitResponse(req: NextRequest, userId: string | undefined, kind: LoadRequestKind) {
  const limit = userId ? LOAD_RATE_LIMITS[kind].user : LOAD_RATE_LIMITS[kind].anonymous;
  const who = userId ? `user:${userId}` : `ip:${getClientIP(req)}`;
  const result = await checkRateLimitWithFallback(`diagram-load:${kind}:${who}`, limit, 3600);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
  return NextResponse.json(
    { error: 'Too many diagram requests. Please try again later.', code: 'RATE_LIMITED', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

const PostSchema = z.object({
  nodes: z.array(z.any()).optional().default([]),
  edges: z.array(z.any()).optional().default([]),
  label: z.string().optional(),
  mermaid: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  /** Also return the diagram drawn as the share page draws it (MCP inline preview). */
  preview: z.boolean().optional().default(false),
  publish: z.boolean().optional().default(false),
  source: z.string().optional(),
  accessType: z.string().optional(),
  linkPermission: z.string().optional(),
  users: z.array(z.any()).optional(),
});

const McpUpdateSchema = z.object({
  action: z.literal('mcp-update'),
  sessionId: z.string().min(1),
  updateToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

const PatchSchema = z.object({
  sessionId: z.string().min(1),
  accessType: z.string().optional(),
  linkPermission: z.string().optional(),
});

const PutSchema = z.object({
  sessionId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['editor', 'viewer']),
});

const DeleteSchema = z.object({
  sessionId: z.string().min(1),
  email: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;

    // MCP publication is opt-in: the server rejects accidental hosted saves
    // below unless the caller supplies publish:true.
    const raw = await req.json();
    if (raw?.action === 'mcp-update') {
      const limited = await rateLimitResponse(req, userId, 'update');
      if (limited) return limited;
      const update = McpUpdateSchema.safeParse(raw);
      if (!update.success) return NextResponse.json({ error: 'Invalid MCP update' }, { status: 400 });
      const existing = await prisma.sharedCanvas.findUnique({ where: { id: update.data.sessionId } });
      if (!existing || existing.mcpUpdateToken !== update.data.updateToken) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const result = await prisma.sharedCanvas.updateMany({
        where: { id: update.data.sessionId, revision: update.data.expectedRevision },
        data: { nodes: update.data.nodes, edges: update.data.edges, revision: { increment: 1 } },
      });
      if (result.count !== 1) return NextResponse.json({ error: 'Revision conflict' }, { status: 409 });
      return NextResponse.json({ sessionId: update.data.sessionId, revision: update.data.expectedRevision + 1 });
    }
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    // Throttle before running the Mermaid pipeline so rejected calls cost nothing.
    const limited = await rateLimitResponse(req, userId, body.dryRun ? 'preview' : 'create');
    if (limited) return limited;

    let nodes = body.nodes || [];
    let edges = body.edges || [];
    let warnings: string[] = [];

    if (body.mermaid) {
      const pipelineResult = await runMermaidPipeline(body.mermaid);
      if (!isDomainSuccess(pipelineResult)) {
        return NextResponse.json({
          error: 'Failed to parse Mermaid code',
          warnings: pipelineResult.warnings
        }, { status: 400 });
      }
      nodes = pipelineResult.data.nodes;
      edges = pipelineResult.data.edges;
      warnings = pipelineResult.data.warnings;
    }

    // Light Studio style, as the share page shows it; vector icons only, so the
    // SVG renders inside an <img> without fetching anything.
    const previewSvg = body.preview
      ? generatePureSVG(nodes, edges, false, PREVIEW_BACKGROUND, /graph\s+(TD|TB|BT)\b/i.test(body.mermaid ?? '') ? 'TD' : 'LR', 'studio-minimal', 'studio-minimal')
      : undefined;

    if (body.dryRun) {
      return NextResponse.json({ nodes, edges, warnings, ...(previewSvg ? { previewSvg } : {}) });
    }

    if (body.source === 'mcp' && !body.publish) {
      return NextResponse.json({ error: 'MCP publication requires explicit publish:true' }, { status: 403 });
    }

    const mcpUpdateToken = body.source === 'mcp' ? crypto.randomUUID() : null;

    const shared = await prisma.sharedCanvas.create({
      data: {
        canvasName: body.label || 'Shared Diagram',
        nodes,
        edges,
        accessType: body.accessType || 'anyone',
        linkPermission: body.linkPermission || 'viewer',
        users: body.users || [],
        ownerId: userId || null,
        mcpUpdateToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await logUsage(userId || null, null, 'share_created', {
      nodeCount: nodes.length,
      accessType: body.accessType,
    });

    return NextResponse.json({ sessionId: shared.id, nodes, edges, warnings, ...(previewSvg ? { previewSvg } : {}), ...(mcpUpdateToken ? { updateToken: mcpUpdateToken, revision: 1 } : {}) });
  } catch (error) {
    logger.error('POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    if (!canAccessFeature(tier, 'share')) {
      return NextResponse.json({ error: 'Sign in to manage sharing', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sessionId, accessType, linkPermission } = parsed.data;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (shared.ownerId && shared.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.sharedCanvas.update({
      where: { id: sessionId },
      data: { accessType, linkPermission },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    if (!canAccessFeature(tier, 'share')) {
      return NextResponse.json({ error: 'Sign in to manage sharing', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = PutSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sessionId, email, name, role } = parsed.data;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (shared.ownerId && shared.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = (shared.users as unknown as ShareUser[]).filter(u => u.email !== email);
    users.push({
      email,
      name: name || '',
      role: role === 'editor' ? 'editor' : 'viewer',
      addedAt: Date.now(),
    });

    await prisma.sharedCanvas.update({
      where: { id: sessionId },
      data: { users: users as unknown as object[] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    if (!canAccessFeature(tier, 'share')) {
      return NextResponse.json({ error: 'Sign in to manage sharing', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = DeleteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sessionId, email } = parsed.data;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (shared.ownerId && shared.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = (shared.users as unknown as ShareUser[]).filter(u => u.email !== email);

    await prisma.sharedCanvas.update({
      where: { id: sessionId },
      data: { users: users as unknown as object[] },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    logger.error('DELETE error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
