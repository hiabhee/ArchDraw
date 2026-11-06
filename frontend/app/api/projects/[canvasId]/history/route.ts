import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getOwnedCanvas } from '@/lib/server/projects/projectCanvas';
import { componentHistoryFor, parseHistoryQuery } from '@/lib/server/projects/componentHistory';

export const runtime = 'nodejs';

/**
 * Who worked on a component of the owner's project canvas, when and why:
 * `?component=<id>&level=overview|detail`. Includes the edited file paths.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const query = parseHistoryQuery(request.nextUrl.searchParams);
    if (!query) return NextResponse.json({ error: 'component is required' }, { status: 400 });
    const { userId, canvas } = await getOwnedCanvas(request, canvasId);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canvas?.agenticProjectId) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });

    const entries = await componentHistoryFor(canvas, query.componentId, query.level, { withFiles: true });
    return NextResponse.json({ entries, serverTime: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Project history GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
