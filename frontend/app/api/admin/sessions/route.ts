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
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const sessionId = searchParams.get('id');
  const includeInternal = searchParams.get('internal') === 'include';

  const db = getAdminClient();

  // Single session detail
  if (sessionId) {
    const { data: session, error: sessionErr } = await db
      .from('sessions')
      .select(`
        *,
        visitors!inner (anon_id, user_id, is_internal)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: events } = await db
      .from('events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ session, events: events || [] });
  }

  // Sessions list
  let query = db
    .from('sessions')
    .select(`
      id,
      visitor_id,
      started_at,
      ended_at,
      duration_seconds,
      entry_page,
      exit_page,
      device_type,
      visitors!inner (anon_id, user_id, is_internal),
      events (id)
    `)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter out internal traffic unless explicitly requested
  if (!includeInternal) {
    query = query.eq('visitors.is_internal', false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten event count
  const sessions = (data || []).map((s: Record<string, unknown> & { events: unknown[] }) => ({
    ...s,
    event_count: Array.isArray(s.events) ? s.events.length : 0,
    events: undefined,
  }));

  return NextResponse.json({ sessions });
}
