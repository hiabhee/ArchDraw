import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sessionId = searchParams.get('id');
    const includeInternal = searchParams.get('internal') === 'include';

    // Single session detail
    if (sessionId) {
      const session = await prisma.visitorSession.findUnique({
        where: { id: sessionId },
        include: {
          visitor: { select: { anonId: true, userId: true, isInternal: true } },
        },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const events = await prisma.event.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({ session, events: events || [] });
    }

    // Sessions list
    const visitorFilter = includeInternal ? {} : { isInternal: false };

    const data = await prisma.visitorSession.findMany({
      where: { visitor: visitorFilter },
      include: {
        visitor: { select: { anonId: true, userId: true, isInternal: true } },
        events: { select: { id: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Flatten event count
    const sessions = data.map((s: typeof data[number]) => ({
      id: s.id,
      visitor_id: s.visitorId,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      duration_seconds: s.durationSeconds,
      entry_page: s.entryPage,
      exit_page: s.exitPage,
      device_type: s.deviceType,
      visitors: s.visitor,
      event_count: s.events.length,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error('Admin sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
