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

    if (!shared) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    const users = Array.isArray(shared.users) ? shared.users : [];

    // Shape must match SharePageClient / SharedCanvasViewer expectations.
    return NextResponse.json({
      canvas: {
        id: shared.id,
        canvas_name: shared.canvasName,
        nodes: shared.nodes,
        edges: shared.edges,
      },
      access: {
        role: 'viewer',
        canEdit:
          shared.accessType === 'anyone' && shared.linkPermission === 'editor',
        users,
        accessType: shared.accessType,
        linkPermission: shared.linkPermission,
      },
    });
  } catch (error) {
    logger.error('Share GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
