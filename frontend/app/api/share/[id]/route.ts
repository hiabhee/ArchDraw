import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const shared = await prisma.sharedCanvas.findUnique({ where: { id } });

    if (shared) {
      return NextResponse.json({
        success: true,
        diagram: {
          nodes: shared.nodes,
          edges: shared.edges,
          label: shared.canvasName,
          createdAt: shared.createdAt.toISOString(),
          users: shared.users,
          accessType: shared.accessType,
          linkPermission: shared.linkPermission,
        }
      });
    }

    return NextResponse.json(
      { error: 'Diagram not found' },
      { status: 404 }
    );
  } catch (error) {
    logger.error('Share GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
