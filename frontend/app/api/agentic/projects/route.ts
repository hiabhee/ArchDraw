import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  repositoryRemote: z.string().trim().max(2048).optional().nullable(),
  defaultBranch: z.string().trim().max(255).optional().nullable(),
  branchName: z.string().trim().max(255).optional().nullable(),
  baseCommitSha: z.string().trim().max(128).optional().nullable(),
});

function normalizeRepositoryRemote(value?: string | null) {
  if (!value) return null;
  const remote = value.trim();
  if (!remote) return null;

  try {
    const url = new URL(remote);
    if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return undefined;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    const scpRemote = remote.match(/^(?:[^@\s]+@)?([^:/\s]+):([^?#\s]+)$/);
    if (!scpRemote) return undefined;
    return `ssh://${scpRemote[1].toLowerCase()}/${scpRemote[2].replace(/^\/+/, '')}`;
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.agenticProject.findMany({
      where: { ownerId: session.user.id },
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
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ projects });
  } catch (error) {
    logger.error('Agentic projects GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = createProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid project payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const repositoryRemote = normalizeRepositoryRemote(body.repositoryRemote);
    if (repositoryRemote === undefined) {
      return NextResponse.json({ error: 'Invalid repository remote' }, { status: 400 });
    }

    const branchName = body.branchName || body.defaultBranch || null;
    const project = await prisma.agenticProject.create({
      data: {
        ownerId: session.user.id,
        name: body.name,
        repositoryRemote,
        defaultBranch: body.defaultBranch || null,
        workspaces: {
          create: {
            bindingKey: randomUUID(),
            branchName,
            baseCommitSha: body.baseCommitSha || null,
            revisions: {
              create: {
                revision: 0,
                baseCommitSha: body.baseCommitSha || null,
                snapshot: { components: [], relationships: [] },
                summary: 'Project created',
                actorType: 'user',
                actorId: session.user.id,
              },
            },
            views: {
              create: {
                name: 'Architecture overview',
                viewType: 'overview',
                state: { focusNodeIds: [], direction: 'LR', annotations: [] },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        repositoryRemote: true,
        defaultBranch: true,
        createdAt: true,
        workspaces: {
          select: {
            id: true,
            branchName: true,
            baseCommitSha: true,
            currentRevision: true,
            revisions: { select: { revision: true } },
            views: { select: { id: true, name: true, viewType: true } },
          },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    logger.error('Agentic projects POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
