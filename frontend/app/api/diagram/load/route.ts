import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { getUserTier, canAccessFeature } from '@/lib/userQuotas';
import { getSessionFromRequest, logUsage } from '@/lib/middleware/quotaCheck';


export interface ShareUser {
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    if (!canAccessFeature(tier, 'share')) {
      return NextResponse.json(
        {
          error: 'Sign in to share diagrams',
          code: 'AUTH_REQUIRED',
          feature: 'sharing',
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    let nodes = body.nodes || [];
    let edges = body.edges || [];
    let warnings: string[] = [];

    if (body.mermaid) {
      const pipelineResult = runMermaidPipeline(body.mermaid);
      if (!pipelineResult.success) {
        return NextResponse.json({
          error: 'Failed to parse Mermaid code',
          warnings: pipelineResult.warnings
        }, { status: 400 });
      }
      nodes = pipelineResult.nodes;
      edges = pipelineResult.edges;
      warnings = pipelineResult.warnings;
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
    const body = await req.json();
    const { sessionId, accessType, linkPermission } = body;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
    const body = await req.json();
    const { sessionId, email, name, role } = body;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const users = (shared.users as unknown as ShareUser[]).filter(u => u.email !== email);
    users.push({
      email,
      name,
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
    const body = await req.json();
    const { sessionId, email } = body;

    const shared = await prisma.sharedCanvas.findUnique({ where: { id: sessionId } });
    if (!shared) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
