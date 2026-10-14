import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { auth } from '@/lib/server/auth';
import { claimAnonymousProject } from '@/lib/server/projects/anonymousProjects';

export const runtime = 'nodejs';

const claimSchema = z.object({ claim: z.string().min(1).max(100) });

/** Signed-in user takes over a project made with `npx archdraw-live`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Sign in to save this project.' }, { status: 401 });

    const parsed = claimSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid claim request' }, { status: 400 });

    const result = await claimAnonymousProject(userId, canvasId, parsed.data.claim);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    return NextResponse.json({ canvasId: result.canvasId, alreadyOwned: result.alreadyOwned });
  } catch (error) {
    logger.error('Project claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
