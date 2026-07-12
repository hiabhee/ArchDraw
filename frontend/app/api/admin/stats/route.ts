import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const includeInternal = searchParams.get('internal') === 'include';
  const excludeInternal = !includeInternal;
  const days = parseInt(searchParams.get('days') || '30', 10);

  const db = getAdminClient();

  // Get stats from the RPC function
  const { data: stats } = await db.rpc('get_visitor_stats', {
    p_exclude_internal: excludeInternal,
  });

  // Get daily active visitors
  let dailyQuery = db.from('daily_active_visitors').select('*').order('day', { ascending: false });
  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    dailyQuery = dailyQuery.gte('day', since);
  }
  const { data: daily } = await dailyQuery;

  // Get top pages
  let topPages;
  if (includeInternal) {
    const { data: allPages } = await db
      .from('events')
      .select('page_path')
      .eq('event_type', 'page_view');
    const counts = new Map<string, number>();
    for (const row of allPages || []) {
      counts.set(row.page_path, (counts.get(row.page_path) || 0) + 1);
    }
    topPages = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page_path, views]) => ({ page_path, views }));
  } else {
    const { data } = await db.from('top_pages').select('*').limit(10);
    topPages = data || [];
  }

  // Get top clicks
  let topClicks;
  if (includeInternal) {
    const { data: allClicks } = await db
      .from('events')
      .select('event_name')
      .eq('event_type', 'click')
      .not('event_name', 'is', null);
    const counts = new Map<string, number>();
    for (const row of allClicks || []) {
      counts.set(row.event_name, (counts.get(row.event_name) || 0) + 1);
    }
    topClicks = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event_name, clicks]) => ({ event_name, clicks }));
  } else {
    const { data } = await db.from('top_click_elements').select('*').limit(10);
    topClicks = data || [];
  }

  // Get export breakdown
  let exportBreakdown;
  if (includeInternal) {
    const { data: allExports } = await db
      .from('events')
      .select('payload')
      .eq('event_type', 'export');
    const counts = new Map<string, { count: number; success: number }>();
    for (const row of allExports || []) {
      const format = String(row.payload?.format || 'unknown');
      const success = Boolean(row.payload?.success ?? true);
      const entry = counts.get(format) || { count: 0, success: 0 };
      entry.count++;
      if (success) entry.success++;
      counts.set(format, entry);
    }
    exportBreakdown = [...counts.entries()]
      .map(([format, { count, success }]) => ({ format, count, success_count: success }));
  } else {
    const { data } = await db.from('export_breakdown').select('*');
    exportBreakdown = data || [];
  }

  // Get funnel
  let funnel;
  if (includeInternal) {
    const stages = ['page_view', 'prompt_submitted', 'diagram_generated', 'export'];
    funnel = [];
    for (let i = 0; i < stages.length; i++) {
      const { count } = await db
        .from('events')
        .select('visitor_id', { count: 'exact', head: true })
        .eq('event_type', stages[i]);
      funnel.push({ stage: stages[i], sort_order: i + 1, unique_visitors: count || 0 });
    }
  } else {
    const { data } = await db.from('funnel_counts').select('*').order('sort_order');
    funnel = data || [];
  }

  return NextResponse.json({
    stats: stats || {},
    daily: daily || [],
    topPages: topPages || [],
    topClicks: topClicks || [],
    exportBreakdown: exportBreakdown || [],
    funnel: funnel || [],
  });
}
