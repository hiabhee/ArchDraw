import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { getUserQuotas, getUserTier } from '@/lib/quotas/userQuotas';
import { createAgenticProject, normalizeRepositoryRemote } from '@/lib/server/projects/agenticProjects';
import { getOwnedCanvas, type ProjectCanvas } from '@/lib/server/projects/projectCanvas';

export const runtime = 'nodejs';

const makeProjectSchema = z.object({
  repositoryRemote: z.string().trim().max(2048).optional().nullable(),
  defaultBranch: z.string().trim().max(255).optional().nullable(),
});

function projectSummary(canvas: Pick<ProjectCanvas, 'id' | 'agenticProjectId' | 'agenticProject'>) {
  return {
    canvasId: canvas.id,
    agenticProjectId: canvas.agenticProjectId,
    workspaceId: canvas.agenticProject?.workspaces[0]?.id ?? null,
    repositoryRemote: canvas.agenticProject?.repositoryRemote ?? null,
  };
}

/** Turn an existing (saved) canvas into a live project. Idempotent. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const { userId, canvas } = await getOwnedCanvas(request, canvasId);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canvas) {
      return NextResponse.json({ error: 'Canvas not found. Save it first.', code: 'CANVAS_NOT_FOUND' }, { status: 404 });
    }
    if (canvas.agenticProjectId) return NextResponse.json({ project: projectSummary(canvas) });

    const parsed = makeProjectSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid project payload' }, { status: 400 });
    const repositoryRemote = normalizeRepositoryRemote(parsed.data.repositoryRemote);
    if (repositoryRemote === undefined) {
      return NextResponse.json({ error: 'Invalid repository remote' }, { status: 400 });
    }

    const { maxProjects } = getUserQuotas(getUserTier(userId));
    const existingProjects = await prisma.userCanvas.count({ where: { userId, agenticProjectId: { not: null } } });
    if (existingProjects >= maxProjects) {
      return NextResponse.json(
        { error: `Your plan allows ${maxProjects} live project${maxProjects === 1 ? '' : 's'}.`, code: 'PROJECT_LIMIT_EXCEEDED' },
        { status: 403 },
      );
    }

    const project = await createAgenticProject(userId, {
      name: canvas.name,
      repositoryRemote,
      defaultBranch: parsed.data.defaultBranch,
    });
    // Conditional link so two concurrent requests can't attach two projects.
    const linked = await prisma.userCanvas.updateMany({
      where: { id: canvas.id, userId, agenticProjectId: null },
      data: { agenticProjectId: project.id },
    });
    if (linked.count !== 1) {
      await prisma.agenticProject.delete({ where: { id: project.id } });
    }

    const fresh = await prisma.userCanvas.findUnique({
      where: { id: canvas.id },
      select: {
        id: true,
        agenticProjectId: true,
        agenticProject: {
          select: { repositoryRemote: true, workspaces: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
        },
      },
    });
    return NextResponse.json({ project: fresh ? projectSummary(fresh) : null }, { status: 201 });
  } catch (error) {
    logger.error('Project POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Turn a project back into a plain canvas. Deleting the agentic project
 * revokes its agent credentials (cascade); agent sessions are cleared.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const { userId, canvas } = await getOwnedCanvas(request, canvasId);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canvas) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.agentSession.deleteMany({ where: { canvasId: canvas.id } }),
      ...(canvas.agenticProjectId
        ? [prisma.agenticProject.deleteMany({ where: { id: canvas.agenticProjectId, ownerId: userId } })]
        : []),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Project DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
