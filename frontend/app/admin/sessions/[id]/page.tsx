'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Clock, MousePointerClick, MessageSquare, Download, AlertCircle } from 'lucide-react';

type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_page: string | null;
  exit_page: string | null;
  device_type: string | null;
  visitors: { anon_id: string; user_id: string | null; is_internal: boolean };
};

type SessionEvent = {
  id: number;
  event_type: string;
  event_name: string | null;
  page_path: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  page_view: Eye,
  page_time: Clock,
  click: MousePointerClick,
  prompt_submitted: MessageSquare,
  export: Download,
  diagram_generated: Eye,
  diagram_generation_failed: AlertCircle,
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function EventTimelineRow({ event }: { event: SessionEvent }) {
  const Icon = EVENT_ICONS[event.event_type] || Eye;
  const time = new Date(event.created_at).toLocaleTimeString();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border-default" />
      {/* Timeline dot */}
      <div className="absolute left-0 top-2 w-[18px] h-[18px] rounded-full bg-surface-panel border-2 border-brand-text flex items-center justify-center z-10">
        <Icon className="w-2.5 h-2.5 text-brand-text" />
      </div>

      <div
        className="py-2 px-3 rounded-lg hover:bg-surface-panel transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted tabular-nums w-16">{time}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            event.event_type === 'click' ? 'bg-warning/10 text-warning'
            : event.event_type === 'prompt_submitted' ? 'bg-purple-500/10 text-purple-400'
            : event.event_type === 'export' ? 'bg-success/10 text-success'
            : event.event_type.includes('failed') ? 'bg-destructive/10 text-destructive'
            : 'bg-brand-text/10 text-brand-text'
          }`}>
            {event.event_type}
          </span>
          {event.event_name && <span className="text-text-secondary">{event.event_name}</span>}
          <span className="text-text-muted ml-auto">{event.page_path}</span>
        </div>

        {expanded && Object.keys(event.payload || {}).length > 0 && (
          <pre className="mt-2 p-2 rounded bg-surface-page text-[10px] text-text-secondary overflow-x-auto border border-border-default">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sessions?id=${sessionId}`);
      const data = await res.json();
      setSession(data.session);
      setEvents(data.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-brand-text border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-12 text-center text-xs text-text-muted">
        Session not found.
      </div>
    );
  }

  const isInternal = session.visitors?.is_internal;
  const isAuth = !!session.visitors?.user_id;

  return (
    <div className="space-y-4 max-w-4xl">
      <button
        onClick={() => router.push('/admin/sessions')}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-brand-text transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Sessions
      </button>

      {/* Session header */}
      <div className="rounded-xl border border-border-default bg-surface-panel p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            isInternal ? 'bg-warning/10 text-warning' : isAuth ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted'
          }`}>
            {isInternal ? 'internal' : isAuth ? 'authenticated' : 'guest'}
          </span>
          <span className="text-xs text-text-secondary font-mono">{session.visitors?.anon_id}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-text-muted block mb-0.5">Started</span>
            <span className="text-text-secondary">{new Date(session.started_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-text-muted block mb-0.5">Duration</span>
            <span className="text-text-secondary">{formatDuration(session.duration_seconds)}</span>
          </div>
          <div>
            <span className="text-text-muted block mb-0.5">Entry Page</span>
            <span className="text-text-secondary">{session.entry_page || '--'}</span>
          </div>
          <div>
            <span className="text-text-muted block mb-0.5">Events</span>
            <span className="text-text-secondary">{events.length}</span>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="rounded-xl border border-border-default bg-surface-panel p-4">
        <h3 className="text-xs text-text-muted uppercase tracking-wider mb-4">Event Timeline</h3>
        <div className="space-y-0">
          {events.map((e) => (
            <EventTimelineRow key={e.id} event={e} />
          ))}
          {events.length === 0 && (
            <div className="text-xs text-text-muted py-4 text-center">No events in this session</div>
          )}
        </div>
      </div>
    </div>
  );
}
