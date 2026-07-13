-- ArchDraw Analytics Pipeline
-- Visitors, Sessions, Events tables + RLS + Admin views
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLES
-- ═══════════════════════════════════════════════════════════════

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  anon_id text unique not null,
  user_id uuid references auth.users(id),
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  first_referrer text,
  first_utm jsonb,
  user_agent text,
  country text,
  is_internal boolean default false
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references visitors(id) not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int,
  entry_page text,
  exit_page text,
  device_type text
);

create table if not exists events (
  id bigint generated always as identity primary key,
  session_id uuid references sessions(id) not null,
  visitor_id uuid references visitors(id) not null,
  event_type text not null,
  event_name text,
  page_path text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ═══════════════════════════════════════════════════════════════

create index if not exists idx_visitors_anon_id on visitors(anon_id);
create index if not exists idx_visitors_user_id on visitors(user_id);
create index if not exists idx_sessions_visitor_id on sessions(visitor_id);
create index if not exists idx_sessions_started_at on sessions(started_at desc);
create index if not exists idx_events_session on events(session_id);
create index if not exists idx_events_visitor on events(visitor_id);
create index if not exists idx_events_type_time on events(event_type, created_at desc);
create index if not exists idx_events_created_at on events(created_at desc);

create table if not exists admin_passcode_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz default now(),
  success boolean default false
);

create index if not exists idx_admin_attempts_ip_time
  on admin_passcode_attempts(ip_hash, attempted_at desc);

-- ═══════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

alter table visitors enable row level security;
alter table sessions enable row level security;
alter table events enable row level security;

-- Service role inserts everything via API routes (no RLS needed for inserts).
-- Admin read: only the admin user_id can select analytics data.
-- Replace 'YOUR_ADMIN_USER_UUID' with your actual auth.users UUID.

create policy "admin_read_visitors" on visitors
  for select using (auth.uid() = 'YOUR_ADMIN_USER_UUID');

create policy "admin_read_sessions" on sessions
  for select using (
    exists (
      select 1 from visitors
      where visitors.id = sessions.visitor_id
        and visitors.user_id = 'YOUR_ADMIN_USER_UUID'
    )
    or auth.uid() = 'YOUR_ADMIN_USER_UUID'
  );

create policy "admin_read_events" on events
  for select using (
    exists (
      select 1 from visitors
      where visitors.id = events.visitor_id
        and visitors.user_id = 'YOUR_ADMIN_USER_UUID'
    )
    or auth.uid() = 'YOUR_ADMIN_USER_UUID'
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. ADMIN VIEWS (heavy aggregates pre-computed)
-- ═══════════════════════════════════════════════════════════════

create or replace view daily_active_visitors as
select
  date_trunc('day', e.created_at)::date as day,
  count(distinct e.visitor_id) as visitors,
  count(distinct case when v.user_id is not null then e.visitor_id end) as authenticated,
  count(distinct case when v.user_id is null then e.visitor_id end) as guests
from events e
join visitors v on v.id = e.visitor_id
where v.is_internal = false
group by 1
order by 1 desc;

create or replace view daily_events as
select
  date_trunc('day', created_at)::date as day,
  event_type,
  count(*) as count
from events
where visitor_id in (select id from visitors where is_internal = false)
group by 1, 2
order by 1 desc;

create or replace view top_click_elements as
select
  event_name,
  count(*) as clicks
from events
where event_type = 'click'
  and visitor_id in (select id from visitors where is_internal = false)
group by 1
order by 2 desc
limit 50;

create or replace view top_pages as
select
  page_path,
  count(*) as views
from events
where event_type = 'page_view'
  and visitor_id in (select id from visitors where is_internal = false)
group by 1
order by 2 desc
limit 50;

create or replace view export_breakdown as
select
  coalesce(payload->>'format', 'unknown') as format,
  count(*) as count,
  count(*) filter (where coalesce((payload->>'success')::boolean, true)) as success_count
from events
where event_type = 'export'
  and visitor_id in (select id from visitors where is_internal = false)
group by 1
order by 2 desc;

create or replace view funnel_counts as
select
  'page_view' as stage,
  1 as sort_order,
  count(distinct visitor_id) as unique_visitors
from events
where event_type = 'page_view'
  and visitor_id in (select id from visitors where is_internal = false)
  and created_at >= now() - interval '30 days'
union all
select
  'prompt_submitted' as stage,
  2 as sort_order,
  count(distinct visitor_id)
from events
where event_type = 'prompt_submitted'
  and visitor_id in (select id from visitors where is_internal = false)
  and created_at >= now() - interval '30 days'
union all
select
  'diagram_generated' as stage,
  3 as sort_order,
  count(distinct visitor_id)
from events
where event_type = 'diagram_generated'
  and visitor_id in (select id from visitors where is_internal = false)
  and created_at >= now() - interval '30 days'
union all
select
  'export' as stage,
  4 as sort_order,
  count(distinct visitor_id)
from events
where event_type = 'export'
  and visitor_id in (select id from visitors where is_internal = false)
  and created_at >= now() - interval '30 days'
order by sort_order;

-- ═══════════════════════════════════════════════════════════════
-- 5. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Get visitor summary stats (used by admin API)
create or replace function get_visitor_stats(p_exclude_internal boolean default true)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'total_visitors', (select count(*) from visitors where (not p_exclude_internal or is_internal = false)),
    'guest_visitors', (select count(*) from visitors where user_id is null and (not p_exclude_internal or is_internal = false)),
    'auth_visitors', (select count(*) from visitors where user_id is not null and (not p_exclude_internal or is_internal = false)),
    'total_sessions', (select count(*) from sessions where visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false))),
    'total_events', (select count(*) from events where visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false))),
    'avg_session_duration', (select coalesce(round(avg(duration_seconds)), 0) from sessions where visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false)) and duration_seconds is not null),
    'prompts_submitted', (select count(*) from events where event_type = 'prompt_submitted' and visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false))),
    'exports_completed', (select count(*) from events where event_type = 'export' and visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false))),
    'diagrams_generated', (select count(*) from events where event_type = 'diagram_generated' and visitor_id in (select id from visitors where (not p_exclude_internal or is_internal = false)))
  ) into result;
  return result;
end;
$$ language plpgsql security definer;
