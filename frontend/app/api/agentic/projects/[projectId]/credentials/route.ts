import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const idSchema = z.string().uuid();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    if (!idSchema.safeParse(projectId).success) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = await prisma.agenticProject.findFirst({
      where: { id: projectId, ownerId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const credentials = await prisma.agenticCredential.findMany({
      where: { projectId, ownerId: session.user.id },
      select: { id: true, name: true, createdAt: true, expiresAt: true, lastUsedAt: true, revokedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      { credentials },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Agentic credentials GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
