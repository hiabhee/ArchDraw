import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashAgenticSecret } from '@/lib/server/agentic-auth';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';

export const runtime = 'nodejs';

const pollPairingSchema = z.object({
  pairingId: z.string().uuid(),
  pollToken: z.string().regex(/^adp_[A-Za-z0-9_-]{43}$/),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = pollPairingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pairing poll request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const pairing = await prisma.agenticPairingRequest.findFirst({
      where: {
        id: parsed.data.pairingId,
        pollTokenHash: hashAgenticSecret(parsed.data.pollToken),
      },
      select: {
        id: true,
        status: true,
        ownerId: true,
        projectId: true,
        workspaceId: true,
        expiresAt: true,
      },
    });
    if (!pairing) {
      return NextResponse.json({ error: 'Pairing request not found' }, { status: 404 });
    }

    if (pairing.expiresAt <= new Date() && pairing.status !== 'completed') {
      await prisma.agenticPairingRequest.updateMany({
        where: { id: pairing.id, status: { in: ['pending', 'approved'] } },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { status: 'expired' },
        { status: 410, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (pairing.status === 'pending') {
      return NextResponse.json(
        { status: 'pending', expiresAt: pairing.expiresAt.toISOString() },
        { status: 202, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (pairing.status === 'completed') {
      return NextResponse.json(
        { status: 'complete', projectId: pairing.projectId, workspaceId: pairing.workspaceId },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (pairing.status !== 'approved' || !pairing.ownerId || !pairing.projectId || !pairing.workspaceId) {
      return NextResponse.json(
        { status: pairing.status },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const delivery = await prisma.$transaction(async (tx) => {
      const claimed = await tx.agenticPairingRequest.updateMany({
        where: { id: pairing.id, status: 'approved', deliveredAt: null, expiresAt: { gt: new Date() } },
        data: { status: 'completed', deliveredAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      await tx.agenticCredential.create({
        data: {
          ownerId: pairing.ownerId!,
          projectId: pairing.projectId!,
          name: 'ArchDraw agent',
          tokenHash: hashAgenticSecret(parsed.data.pollToken),
          expiresAt,
        },
      });

      return {
        projectId: pairing.projectId!,
        workspaceId: pairing.workspaceId!,
        expiresAt: expiresAt.toISOString(),
      };
    });

    if (!delivery) {
      const latest = await prisma.agenticPairingRequest.findUnique({
        where: { id: pairing.id },
        select: { status: true, projectId: true, workspaceId: true },
      });
      if (latest?.status === 'completed') {
        return NextResponse.json(
          { status: 'complete', projectId: latest.projectId, workspaceId: latest.workspaceId },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json(
        { status: 'pending' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { status: 'complete', ...delivery },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Agentic pairing poll error:', error);
    return NextResponse.json(
      { error: 'Unable to check pairing status' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
