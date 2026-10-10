import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgenticPrincipal } from '@/lib/server/agentic-auth';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';

export const runtime = 'nodejs';

const idSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; workspaceId: string }> }
) {
  try {
    const { projectId, workspaceId } = await params;
    if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(workspaceId).success) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const principal = await getAgenticPrincipal(request, projectId);
    if (!principal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await prisma.agenticWorkspace.findFirst({
      where: {
        id: workspaceId,
        projectId,
        project: {
          is: principal.credentialId ? { id: projectId } : { ownerId: principal.userId },
        },
      },
      select: {
        id: true,
        projectId: true,
        branchName: true,
        baseCommitSha: true,
        currentRevision: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const [currentRevision, views, proposals] = await Promise.all([
      prisma.agenticArchitectureRevision.findUnique({
        where: {
          workspaceId_revision: {
            workspaceId: workspace.id,
            revision: workspace.currentRevision,
          },
        },
        select: {
          revision: true,
          baseCommitSha: true,
          snapshot: true,
          summary: true,
          actorType: true,
          createdAt: true,
        },
      }),
      prisma.agenticProjectView.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, name: true, viewType: true, state: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.agenticProposal.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, baseRevision: true, title: true, summary: true, status: true, decision: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      workspace,
      architecture: currentRevision?.snapshot ?? { components: [], relationships: [] },
      revision: currentRevision,
      views,
      proposals,
    });
  } catch (error) {
    logger.error('Agentic workspace GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
