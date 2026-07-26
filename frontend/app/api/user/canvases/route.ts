import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserCanvases, upsertUserCanvas } from '@/lib/db';
import { headers } from 'next/headers';
import { getUserTier, getUserQuotas } from '@/lib/userQuotas';
import prisma from '@/lib/prisma';

const putSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nodes: z.any(),
  edges: z.any(),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const canvases = await getUserCanvases(session.user.id);
  return NextResponse.json(canvases);
}

export async function PUT(req: NextRequest) {
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

  if (body.nodes && Array.isArray(body.nodes) && body.nodes.length > quotas.maxNodesPerCanvas) {
    return NextResponse.json(
      {
        error: `Canvas too large. Maximum ${quotas.maxNodesPerCanvas} nodes allowed for your tier.`,
        code: 'CANVAS_SIZE_EXCEEDED',
      },
      { status: 400 }
    );
  }

  const existingCanvases = await prisma.userCanvas.count({
    where: { userId },
  });

  const existingCanvas = await prisma.userCanvas.findUnique({
    where: { id: body.id },
    select: { id: true, userId: true },
  });

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
}
