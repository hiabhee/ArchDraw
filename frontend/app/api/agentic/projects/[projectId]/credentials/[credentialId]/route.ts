import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const idSchema = z.string().uuid();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; credentialId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, credentialId } = await params;
    if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(credentialId).success) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const revoked = await prisma.agenticCredential.updateMany({
      where: {
        id: credentialId,
        projectId,
        ownerId: session.user.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Agentic credential revocation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
