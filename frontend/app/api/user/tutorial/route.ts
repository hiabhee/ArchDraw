import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { upsertTutorialProgress, deleteTutorialProgress } from '@/lib/db';
import { headers } from 'next/headers';

const putSchema = z.object({
  tutorialId: z.string().min(1),
  currentLevel: z.number().int().min(0),
  currentStep: z.number().int().min(0),
  currentPhase: z.string(),
  completedLevels: z.array(z.number().int()),
  canvasNodes: z.any(),
  canvasEdges: z.any(),
  explainCount: z.number().int().min(0),
});

const deleteSchema = z.object({
  tutorialId: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = await req.json();
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await upsertTutorialProgress(session.user.id, parsed.data);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = await req.json();
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await deleteTutorialProgress(session.user.id, parsed.data.tutorialId);
  return NextResponse.json(result);
}
