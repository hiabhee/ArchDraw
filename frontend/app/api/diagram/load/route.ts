import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';
import { getUserTier, canAccessFeature } from '@/lib/userQuotas';
import { getSessionFromRequest, logUsage } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';

export interface ShareUser {
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

const PostSchema = z.object({
  nodes: z.array(z.any()).optional().default([]),
  edges: z.array(z.any()).optional().default([]),
  label: z.string().optional(),
  mermaid: z.string().optional(),
  accessType: z.string().optional(),
  linkPermission: z.string().optional(),
  users: z.array(z.any()).optional(),
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

    // Previously blocked unauthenticated / MCP-originated saves with a
    // `canAccessFeature(tier, 'share')` check that returned 401 for guests.
    // The MCP server calls this endpoint to persist a generated diagram and
    // receive a sessionId — it never sends auth credentials, so the guard
    // made the tool unusable. POST creates a public sharedCanvas record which
    // is intentionally world-writable; the sharing admin (PATCH/PUT/DELETE)
    // below remains guarded by userId/ownerId checks.
    const raw = await req.json();
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

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

    const shared = await prisma.sharedCanvas.create({
      data: {
        canvasName: body.label || 'Shared Diagram',
        nodes,
        edges,
        accessType: body.accessType || 'anyone',
        linkPermission: body.linkPermission || 'viewer',
        users: body.users || [],
        ownerId: userId || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await logUsage(userId || null, null, 'share_created', {
      nodeCount: nodes.length,
      accessType: body.accessType,
    });

    return NextResponse.json({ sessionId: shared.id, nodes, edges, warnings });
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
