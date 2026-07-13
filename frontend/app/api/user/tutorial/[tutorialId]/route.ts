import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTutorialProgress } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tutorialId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tutorialId } = await params;
  const progress = await getTutorialProgress(session.user.id, tutorialId);
  return NextResponse.json(progress);
}
