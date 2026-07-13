import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const includeInternal = searchParams.get('internal') === 'include';
  const days = parseInt(searchParams.get('days') || '30', 10);

  const internalFilter = includeInternal ? {} : { isInternal: false };

  // Get visitor stats (replaces RPC function)
  const [totalVisitors, guestVisitors, authVisitors, totalSessions, totalEvents, avgDuration, promptsSubmitted, exportsCompleted, diagramsGenerated] = await Promise.all([
    prisma.visitor.count({ where: internalFilter }),
    prisma.visitor.count({ where: { ...internalFilter, userId: null } }),
    prisma.visitor.count({ where: { ...internalFilter, userId: { not: null } } }),
    prisma.visitorSession.count({ where: { visitor: internalFilter } }),
    prisma.event.count({ where: { visitor: internalFilter } }),
    prisma.visitorSession.aggregate({ where: { visitor: internalFilter, durationSeconds: { not: null } }, _avg: { durationSeconds: true } }),
    prisma.event.count({ where: { visitor: internalFilter, eventType: 'prompt_submitted' } }),
    prisma.event.count({ where: { visitor: internalFilter, eventType: 'export' } }),
    prisma.event.count({ where: { visitor: internalFilter, eventType: 'diagram_generated' } }),
  ]);

  const stats = {
    total_visitors: totalVisitors,
    guest_visitors: guestVisitors,
    auth_visitors: authVisitors,
    total_sessions: totalSessions,
    total_events: totalEvents,
    avg_session_duration: Math.round(avgDuration._avg.durationSeconds ?? 0),
    prompts_submitted: promptsSubmitted,
    exports_completed: exportsCompleted,
    diagrams_generated: diagramsGenerated,
  };

  // Get daily active visitors — count distinct visitor_id per day
  const since = new Date(Date.now() - days * 86400000);
  const dailyRaw = await prisma.$queryRaw<{ day: string; visitors: bigint }[]>`
    SELECT date_trunc('day', created_at)::date as day, count(distinct visitor_id) as visitors
    FROM events
    WHERE created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 DESC
  `;
  const daily = dailyRaw.map(r => ({ day: String(r.day), visitors: Number(r.visitors) }));

  // Get top pages
  let topPages;
  if (includeInternal) {
    const allPages = await prisma.event.findMany({
      where: { eventType: 'page_view' },
      select: { pagePath: true },
    });
    const counts = new Map<string, number>();
    for (const row of allPages) {
      if (row.pagePath) counts.set(row.pagePath, (counts.get(row.pagePath) || 0) + 1);
    }
    topPages = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page_path, views]) => ({ page_path, views }));
  } else {
    const pageCounts = await prisma.event.groupBy({
      by: ['pagePath'],
      where: { eventType: 'page_view', visitor: internalFilter, pagePath: { not: null } },
      _count: true,
      orderBy: { _count: { pagePath: 'desc' } },
      take: 10,
    });
    topPages = pageCounts.map((r: typeof pageCounts[number]) => ({ page_path: r.pagePath, views: r._count }));
  }

  // Get top clicks
  let topClicks;
  if (includeInternal) {
    const allClicks = await prisma.event.findMany({
      where: { eventType: 'click', eventName: { not: null } },
      select: { eventName: true },
    });
    const counts = new Map<string, number>();
    for (const row of allClicks) {
      if (row.eventName) counts.set(row.eventName, (counts.get(row.eventName) || 0) + 1);
    }
    topClicks = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([event_name, clicks]) => ({ event_name, clicks }));
  } else {
    const clickCounts = await prisma.event.groupBy({
      by: ['eventName'],
      where: { eventType: 'click', visitor: internalFilter, eventName: { not: null } },
      _count: true,
      orderBy: { _count: { eventName: 'desc' } },
      take: 10,
    });
    topClicks = clickCounts.map((r: typeof clickCounts[number]) => ({ event_name: r.eventName, clicks: r._count }));
  }

  // Get export breakdown
  let exportBreakdown;
  if (includeInternal) {
    const allExports = await prisma.event.findMany({
      where: { eventType: 'export' },
      select: { payload: true },
    });
    const counts = new Map<string, { count: number; success: number }>();
    for (const row of allExports) {
      const p = row.payload as Record<string, unknown>;
      const format = String(p?.format || 'unknown');
      const success = Boolean(p?.success ?? true);
      const entry = counts.get(format) || { count: 0, success: 0 };
      entry.count++;
      if (success) entry.success++;
      counts.set(format, entry);
    }
    exportBreakdown = [...counts.entries()].map(([format, { count, success }]) => ({ format, count, success_count: success }));
  } else {
    // For filtered, use raw query for complex aggregation
    const exports = await prisma.event.findMany({
      where: { eventType: 'export', visitor: internalFilter },
      select: { payload: true },
    });
    const counts = new Map<string, { count: number; success: number }>();
    for (const row of exports) {
      const p = row.payload as Record<string, unknown>;
      const format = String(p?.format || 'unknown');
      const success = Boolean(p?.success ?? true);
      const entry = counts.get(format) || { count: 0, success: 0 };
      entry.count++;
      if (success) entry.success++;
      counts.set(format, entry);
    }
    exportBreakdown = [...counts.entries()].map(([format, { count, success }]) => ({ format, count, success_count: success }));
  }

  // Get funnel
  const stages = ['page_view', 'prompt_submitted', 'diagram_generated', 'export'];
  const funnel = [];
  for (let i = 0; i < stages.length; i++) {
    const count = await prisma.event.count({
      where: { eventType: stages[i], visitor: internalFilter },
    });
    funnel.push({ stage: stages[i], sort_order: i + 1, unique_visitors: count });
  }

  return NextResponse.json({
    stats,
    daily,
    topPages,
    topClicks,
    exportBreakdown,
    funnel,
  });
}
