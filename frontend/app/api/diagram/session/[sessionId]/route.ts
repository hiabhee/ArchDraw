import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const shared = await prisma.sharedCanvas.findUnique({
      where: { id: sessionId },
      select: { canvasName: true, nodes: true, edges: true, createdAt: true, expiresAt: true },
    });

    if (!shared) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      nodes: shared.nodes,
      edges: shared.edges,
      label: shared.canvasName,
      createdAt: shared.createdAt,
      source: 'manual',
    });
  } catch (error) {
    logger.error('Diagram session GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
