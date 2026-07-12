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
      <div className="absolute left-[9px] top-0 bottom-0 w-px bg-[#18191a]" />
      {/* Timeline dot */}
      <div className="absolute left-0 top-2 w-[18px] h-[18px] rounded-full bg-[#141516] border-2 border-[#1E90FF] flex items-center justify-center z-10">
        <Icon className="w-2.5 h-2.5 text-[#1E90FF]" />
      </div>

      <div
        className="py-2 px-3 rounded-lg hover:bg-[#141516] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#62666d] tabular-nums w-16">{time}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            event.event_type === 'click' ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
            : event.event_type === 'prompt_submitted' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]'
            : event.event_type === 'export' ? 'bg-[#10b981]/10 text-[#10b981]'
            : event.event_type.includes('failed') ? 'bg-[#ef4444]/10 text-[#ef4444]'
            : 'bg-[#1E90FF]/10 text-[#1E90FF]'
          }`}>
            {event.event_type}
          </span>
          {event.event_name && <span className="text-[#d0d6e0]">{event.event_name}</span>}
          <span className="text-[#8a8f98] ml-auto">{event.page_path}</span>
        </div>

        {expanded && Object.keys(event.payload || {}).length > 0 && (
          <pre className="mt-2 p-2 rounded bg-[#010102] text-[10px] text-[#d0d6e0] overflow-x-auto border border-[#18191a]">
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
        <div className="w-5 h-5 border-2 border-[#1E90FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-12 text-center text-xs text-[#62666d]">
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
        className="flex items-center gap-1.5 text-xs text-[#8a8f98] hover:text-[#1E90FF] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Sessions
      </button>

      {/* Session header */}
      <div className="rounded-xl border border-[#18191a] bg-[#0f1011] p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            isInternal ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isAuth ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#8a8f98]/10 text-[#8a8f98]'
          }`}>
            {isInternal ? 'internal' : isAuth ? 'authenticated' : 'guest'}
          </span>
          <span className="text-xs text-[#d0d6e0] font-mono">{session.visitors?.anon_id}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[#62666d] block mb-0.5">Started</span>
            <span className="text-[#d0d6e0]">{new Date(session.started_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[#62666d] block mb-0.5">Duration</span>
            <span className="text-[#d0d6e0]">{formatDuration(session.duration_seconds)}</span>
          </div>
          <div>
            <span className="text-[#62666d] block mb-0.5">Entry Page</span>
            <span className="text-[#d0d6e0]">{session.entry_page || '--'}</span>
          </div>
          <div>
            <span className="text-[#62666d] block mb-0.5">Events</span>
            <span className="text-[#d0d6e0]">{events.length}</span>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="rounded-xl border border-[#18191a] bg-[#0f1011] p-4">
        <h3 className="text-xs text-[#8a8f98] uppercase tracking-wider mb-4">Event Timeline</h3>
        <div className="space-y-0">
          {events.map((e) => (
            <EventTimelineRow key={e.id} event={e} />
          ))}
          {events.length === 0 && (
            <div className="text-xs text-[#62666d] py-4 text-center">No events in this session</div>
          )}
        </div>
      </div>
    </div>
  );
}
