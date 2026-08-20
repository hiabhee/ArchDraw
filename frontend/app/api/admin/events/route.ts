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
    const eventType = searchParams.get('event_type');
    const sessionId = searchParams.get('session_id');
    const visitorId = searchParams.get('visitor_id');
    const search = searchParams.get('search');
    const includeInternal = searchParams.get('internal') === 'include';

    const where: Record<string, unknown> = {};
    if (eventType) where.eventType = eventType;
    if (sessionId) where.sessionId = sessionId;
    if (visitorId) where.visitorId = visitorId;
    if (search) {
      where.OR = [
        { eventName: { contains: search, mode: 'insensitive' } },
        { pagePath: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (!includeInternal) {
      where.visitor = { isInternal: false };
    }

    const data = await prisma.event.findMany({
      where,
      include: {
        visitor: { select: { anonId: true, userId: true, isInternal: true } },
        session: { select: { entryPage: true, deviceType: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    return NextResponse.json({ events: data || [] });
  } catch (error) {
    logger.error('Admin events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
