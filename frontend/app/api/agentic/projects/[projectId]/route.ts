import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgenticPrincipal } from '@/lib/server/agentic-auth';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';

export const runtime = 'nodejs';

const idSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!idSchema.safeParse(projectId).success) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const principal = await getAgenticPrincipal(request, projectId);
    if (!principal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.agenticProject.findFirst({
      where: {
        id: projectId,
        ...(principal.credentialId ? {} : { ownerId: principal.userId }),
      },
      select: {
        id: true,
        name: true,
        repositoryRemote: true,
        defaultBranch: true,
        createdAt: true,
        updatedAt: true,
        workspaces: {
          select: {
            id: true,
            branchName: true,
            baseCommitSha: true,
            currentRevision: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    logger.error('Agentic project GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
