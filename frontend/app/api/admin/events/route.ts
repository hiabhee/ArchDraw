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
  const eventType = searchParams.get('event_type');
  const sessionId = searchParams.get('session_id');
  const visitorId = searchParams.get('visitor_id');
  const search = searchParams.get('search');
  const includeInternal = searchParams.get('internal') === 'include';

  const db = getAdminClient();

  let query = db
    .from('events')
    .select(`
      id,
      session_id,
      visitor_id,
      event_type,
      event_name,
      page_path,
      payload,
      created_at,
      visitors!inner (anon_id, user_id, is_internal),
      sessions (entry_page, device_type)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventType) query = query.eq('event_type', eventType);
  if (sessionId) query = query.eq('session_id', sessionId);
  if (visitorId) query = query.eq('visitor_id', visitorId);
  if (search) {
    query = query.or(`event_name.ilike.%${search}%,page_path.ilike.%${search}%`);
  }

  // Filter out internal traffic unless explicitly requested
  if (!includeInternal) {
    query = query.eq('visitors.is_internal', false);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}
