import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { getClientIP } from '@/lib/server/ip';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { parseWatchToken, verifyWatchToken } from '@/lib/server/projects/watchLink';
import { componentHistoryFor, parseHistoryQuery } from '@/lib/server/projects/componentHistory';

export const runtime = 'nodejs';

/** Opened on click, not polled: a lower limit than the live snapshot. */
const HISTORY_REQUESTS_PER_MINUTE = 60;

const notFound = () => NextResponse.json({ error: 'This live project link is invalid or was stopped.' }, { status: 404 });

/**
 * A component's history for watchers of a live project (no sign-in). Same
 * entries as the owner sees, without file paths (only how many files).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const rate = await checkRateLimitWithFallback(`live-history:${getClientIP(request)}`, HISTORY_REQUESTS_PER_MINUTE, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const query = parseHistoryQuery(request.nextUrl.searchParams);
    if (!query) return NextResponse.json({ error: 'component is required' }, { status: 400 });

    const parsed = parseWatchToken(token);
    if (!parsed) return notFound();
    const canvas = await prisma.userCanvas.findUnique({
      where: { id: parsed.canvasId },
      select: { id: true, nodes: true, agenticProjectId: true },
    });
    if (!canvas?.agenticProjectId || !verifyWatchToken(token, canvas.id, canvas.agenticProjectId)) return notFound();

    const entries = await componentHistoryFor(canvas, query.componentId, query.level, { withFiles: false });
    return NextResponse.json({ entries, serverTime: Date.now() }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  } catch (error) {
    logger.error('Live watch history GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
