'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, ArrowRight } from 'lucide-react';

type Session = {
  id: string;
  visitor_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_page: string | null;
  exit_page: string | null;
  device_type: string | null;
  event_count: number;
  visitors: { anon_id: string; user_id: string | null; is_internal: boolean };
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function SessionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const internalParam = searchParams.get('internal') || '';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (internalParam) params.set('internal', internalParam);
      const res = await fetch(`/api/admin/sessions?${params.toString()}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [internalParam]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Sessions</h1>
        <button
          onClick={fetchSessions}
          className="p-1.5 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-brand-text transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-page overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_140px_80px_100px_80px_40px] gap-2 py-2 px-3 border-b border-border-default text-[10px] text-text-muted uppercase tracking-wider">
          <span>Visitor</span>
          <span>Started</span>
          <span>Entry Page</span>
          <span>Duration</span>
          <span>Events</span>
          <span>Type</span>
          <span />
        </div>

        {/* Rows */}
        <div className="max-h-[calc(100vh-200px)] overflow-auto">
          {sessions.length === 0 && !loading ? (
            <div className="py-12 text-center text-xs text-text-muted">
              No sessions yet.
            </div>
          ) : (
            sessions.map((s) => {
              const isInternal = s.visitors?.is_internal;
              const isAuth = !!s.visitors?.user_id;
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_120px_140px_80px_100px_80px_40px] gap-2 py-2 px-3 border-b border-border-default/50 text-xs hover:bg-surface-panel transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/sessions/${s.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                      isInternal ? 'bg-warning/10 text-warning' : isAuth ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted'
                    }`}>
                      {isInternal ? 'internal' : isAuth ? 'auth' : 'guest'}
                    </span>
                    <span className="text-text-secondary truncate" title={s.visitors?.anon_id}>
                      {s.visitors?.anon_id?.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-text-muted tabular-nums">{formatTime(s.started_at)}</span>
                  <span className="text-text-secondary truncate">{s.entry_page || '--'}</span>
                  <span className="text-text-muted tabular-nums">{formatDuration(s.duration_seconds)}</span>
                  <span className="text-text-muted tabular-nums">{s.event_count}</span>
                  <span className="text-text-muted">{s.device_type || '--'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted self-center justify-self-end" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
