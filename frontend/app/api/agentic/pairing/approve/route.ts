import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { hashAgenticSecret } from '@/lib/agentic-auth';

export const runtime = 'nodejs';

const approvePairingSchema = z.object({
  userCode: z.string().trim().min(12).max(24),
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

function normalizeUserCode(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = approvePairingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid pairing approval' }, { status: 400 });
    }

    const userCode = normalizeUserCode(parsed.data.userCode);
    if (userCode.length !== 12) {
      return NextResponse.json({ error: 'Pairing code is invalid or expired' }, { status: 404 });
    }

    const now = new Date();
    const pairing = await prisma.agenticPairingRequest.findFirst({
      where: {
        userCodeHash: hashAgenticSecret(userCode),
        status: 'pending',
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (!pairing) {
      return NextResponse.json({ error: 'Pairing code is invalid or expired' }, { status: 404 });
    }

    const [project, workspace] = await Promise.all([
      prisma.agenticProject.findFirst({
        where: { id: parsed.data.projectId, ownerId: session.user.id },
        select: { id: true },
      }),
      prisma.agenticWorkspace.findFirst({
        where: {
          id: parsed.data.workspaceId,
          projectId: parsed.data.projectId,
          project: { is: { ownerId: session.user.id } },
        },
        select: { id: true },
      }),
    ]);

    if (!project || !workspace) {
      return NextResponse.json({ error: 'Project or workspace not found' }, { status: 404 });
    }

    const approved = await prisma.agenticPairingRequest.updateMany({
      where: { id: pairing.id, status: 'pending', expiresAt: { gt: now } },
      data: {
        status: 'approved',
        ownerId: session.user.id,
        projectId: project.id,
        workspaceId: workspace.id,
        approvedAt: now,
      },
    });

    if (approved.count !== 1) {
      return NextResponse.json({ error: 'Pairing request was already used or expired' }, { status: 409 });
    }

    return NextResponse.json(
      { approved: true, projectId: project.id, workspaceId: workspace.id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Agentic pairing approval error:', error);
    return NextResponse.json({ error: 'Unable to approve pairing' }, { status: 500 });
  }
}
