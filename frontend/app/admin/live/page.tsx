'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Eye, MousePointerClick, MessageSquare, Download, Clock, BookOpen, Bot, Share2, Settings, ToggleRight } from 'lucide-react';

type Event = {
  id: number;
  session_id: string;
  visitor_id: string;
  event_type: string;
  event_name: string | null;
  page_path: string;
  payload: Record<string, unknown>;
  created_at: string;
  visitors: { anon_id: string; user_id: string | null; is_internal: boolean };
  sessions: { entry_page: string; device_type: string } | null;
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  page_view: Eye,
  page_time: Clock,
  click: MousePointerClick,
  prompt_submitted: MessageSquare,
  export: Download,
  tutorial_interaction: BookOpen,
  ai_generation: Bot,
  ai_settings: Bot,
  sharing: Share2,
  settings_interaction: Settings,
  ui_interaction: ToggleRight,
};

function EventRow({ event }: { event: Event }) {
  const Icon = EVENT_ICONS[event.event_type] || Eye;
  const isAuth = !!event.visitors?.user_id;
  const isInternal = event.visitors?.is_internal;
  const time = new Date(event.created_at).toLocaleTimeString();

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#141516] transition-colors text-xs border-b border-[#18191a]/50">
      <span className="text-[#62666d] w-16 shrink-0 tabular-nums">{time}</span>
      <Icon className="w-3.5 h-3.5 text-[#1E90FF] shrink-0" />
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        event.event_type === 'click' ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
        : event.event_type === 'prompt_submitted' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]'
        : event.event_type === 'export' ? 'bg-[#10b981]/10 text-[#10b981]'
        : event.event_type === 'tutorial_interaction' ? 'bg-[#f97316]/10 text-[#f97316]'
        : event.event_type === 'ai_generation' ? 'bg-[#06b6d4]/10 text-[#06b6d4]'
        : event.event_type === 'ai_settings' ? 'bg-[#06b6d4]/10 text-[#06b6d4]'
        : event.event_type === 'sharing' ? 'bg-[#ec4899]/10 text-[#ec4899]'
        : event.event_type === 'settings_interaction' ? 'bg-[#a855f7]/10 text-[#a855f7]'
        : event.event_type === 'ui_interaction' ? 'bg-[#14b8a6]/10 text-[#14b8a6]'
        : 'bg-[#1E90FF]/10 text-[#1E90FF]'
      }`}>
        {event.event_type}
      </span>
      {event.event_name && (
        <span className="text-[#d0d6e0] truncate max-w-[150px]">{event.event_name}</span>
      )}
      <span className="text-[#8a8f98] truncate flex-1">{event.page_path}</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
        isInternal ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isAuth ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#8a8f98]/10 text-[#8a8f98]'
      }`}>
        {isInternal ? 'internal' : isAuth ? 'auth' : 'guest'}
      </span>
      <span className="text-[#62666d] w-16 truncate text-right tabular-nums" title={event.visitors?.anon_id}>
        {event.visitors?.anon_id?.slice(0, 6)}
      </span>
    </div>
  );
}

export default function LiveFeedPage() {
  const searchParams = useSearchParams();
  const internalParam = searchParams.get('internal') || '';
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (internalParam) params.set('internal', internalParam);
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [internalParam]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEvents]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Live Feed</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              autoRefresh
                ? 'border-[#1E90FF] text-[#1E90FF] bg-[#1E90FF]/10'
                : 'border-[#18191a] text-[#8a8f98] hover:border-[#1E90FF]'
            }`}
          >
            {autoRefresh ? 'Auto-refreshing' : 'Paused'}
          </button>
          <button
            onClick={fetchEvents}
            className="p-1.5 rounded-lg border border-[#18191a] text-[#8a8f98] hover:text-[#f7f8f8] hover:border-[#1E90FF] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#18191a] bg-[#0f1011] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 py-2 px-3 border-b border-[#18191a] text-[10px] text-[#62666d] uppercase tracking-wider">
          <span className="w-16 shrink-0">Time</span>
          <span className="w-3.5 shrink-0" />
          <span className="w-[70px]">Type</span>
          <span className="max-w-[150px]">Name</span>
          <span className="flex-1">Path</span>
          <span className="w-[50px]">Visitor</span>
          <span className="w-16 text-right">ID</span>
        </div>

        {/* Events */}
        <div className="max-h-[calc(100vh-200px)] overflow-auto">
          {events.length === 0 && !loading ? (
            <div className="py-12 text-center text-xs text-[#62666d]">
              No events yet. Start using the app to see tracking data flow in.
            </div>
          ) : (
            events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </div>
    </div>
  );
}
