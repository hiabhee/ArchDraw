import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserCanvases, upsertUserCanvas } from '@/lib/db';
import { headers } from 'next/headers';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';
import { isTextNode } from '@/lib/mermaid/textNodes';
import logger from '@/lib/logger';

const putSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nodes: z.any(),
  edges: z.any(),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canvases = await getUserCanvases(session.user.id);
    return NextResponse.json(canvases);
  } catch (error) {
    logger.error('User canvases GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const tier = getUserTier(userId);
    const quotas = getUserQuotas(tier);
    const raw = await req.json();
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    // Node caps count shape/leaf nodes only; text elements (title/notes) are excluded.
    const shapeNodeCount = (body.nodes ?? []).filter((n: { type?: string }) => !isTextNode(n)).length;
    if (shapeNodeCount > quotas.maxNodesPerCanvas) {
      return NextResponse.json(
        {
          error: `Canvas too large. Maximum ${quotas.maxNodesPerCanvas} nodes allowed for your tier.`,
          code: 'CANVAS_SIZE_EXCEEDED',
        },
        { status: 400 }
      );
    }

    const [existingCanvases, existingCanvas] = await Promise.all([
      prisma.userCanvas.count({ where: { userId } }),
      prisma.userCanvas.findUnique({ where: { id: body.id }, select: { id: true, userId: true } }),
    ]);

    // IDOR guard: an existing canvas must belong to the signed-in user before
    // it can be overwritten. Without this, PUT with a victim's canvas id would
    // upsert into their record (the delete sibling already scopes by userId).
    if (existingCanvas && existingCanvas.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isNewCanvas = !existingCanvas;

    if (isNewCanvas && existingCanvases >= quotas.maxCanvases) {
      return NextResponse.json(
        {
          error: `Maximum ${quotas.maxCanvases} canvases allowed. Delete one to create a new canvas.`,
          code: 'CANVAS_LIMIT_EXCEEDED',
        },
        { status: 400 }
      );
    }

    const result = await upsertUserCanvas(userId, body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('User canvases PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
