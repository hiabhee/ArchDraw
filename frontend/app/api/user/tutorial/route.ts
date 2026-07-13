import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertTutorialProgress, deleteTutorialProgress } from '@/lib/db';
import { headers } from 'next/headers';

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const result = await upsertTutorialProgress(session.user.id, body);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tutorialId } = await req.json();
  const result = await deleteTutorialProgress(session.user.id, tutorialId);
  return NextResponse.json(result);
}
