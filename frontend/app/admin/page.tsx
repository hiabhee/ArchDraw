'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, UserCheck, MousePointerClick, Clock, MessageSquare, Download, RefreshCw, BookOpen, Bot, Share2, Settings, AlertTriangle } from 'lucide-react';

type Stats = {
  total_visitors: number;
  guest_visitors: number;
  auth_visitors: number;
  total_sessions: number;
  total_events: number;
  avg_session_duration: number;
  prompts_submitted: number;
  exports_completed: number;
  diagrams_generated: number;
  tutorial_interactions: number;
  ai_generations: number;
  ai_generation_errors: number;
  ai_generation_success: number;
  sharing_events: number;
  settings_events: number;
  ui_interactions: number;
};

type DailyRow = { day: string; visitors: number; authenticated: number; guests: number };
type FunnelRow = { stage: string; sort_order: number; unique_visitors: number };

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; sub?: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-brand-text" />
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, maxBars = 10 }: { data: Record<string, string | number>[]; labelKey: string; valueKey: string; maxBars?: number }) {
  const items = data.slice(0, maxBars);
  const maxVal = Math.max(...items.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-1.5">
      {items.length === 0 && <div className="text-xs text-text-muted py-4 text-center">No data yet</div>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-[140px] truncate text-text-secondary shrink-0" title={String(item[labelKey])}>
            {String(item[labelKey])}
          </div>
          <div className="flex-1 h-4 bg-surface-panel rounded overflow-hidden">
            <div
              className="h-full bg-brand-text rounded transition-all duration-500"
              style={{ width: `${(Number(item[valueKey]) / maxVal) * 100}%` }}
            />
          </div>
          <div className="w-10 text-right text-text-muted tabular-nums">{Number(item[valueKey])}</div>
        </div>
      ))}
    </div>
  );
}

function MiniLineChart({ data }: { data: DailyRow[] }) {
  if (data.length === 0) return <div className="text-xs text-text-muted py-8 text-center">No data yet</div>;

  const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day));
  const maxVal = Math.max(...sorted.map((d) => d.visitors), 1);
  const width = 100;
  const height = 40;
  const step = width / Math.max(sorted.length - 1, 1);

  const points = sorted.map((d, i) => ({
    x: i * step,
    y: height - (d.visitors / maxVal) * (height - 4),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1" fill="var(--accent)" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-text-muted mt-1 px-1">
        <span>{sorted[0]?.day}</span>
        <span>{sorted[sorted.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AdminOverview() {
  const searchParams = useSearchParams();
  const internalParam = searchParams.get('internal') || '';
  const [data, setData] = useState<{
    stats: Stats;
    daily: DailyRow[];
    topPages: { page_path: string; views: number }[];
    topClicks: { event_name: string; clicks: number }[];
    exportBreakdown: { format: string; count: number; success_count: number }[];
    funnel: FunnelRow[];
    tutorialBreakdown: { event_name: string; count: number }[];
    aiBreakdown: { event_name: string; count: number }[];
    sharingBreakdown: { event_name: string; count: number }[];
    settingsBreakdown: { event_name: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (internalParam) params.set('internal', internalParam);
      const res = await fetch(`/api/admin/stats?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days, internalParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 text-brand-text animate-spin" />
      </div>
    );
  }

  const s = (data?.stats || {}) as Stats;
  const funnel: FunnelRow[] = data?.funnel || [];
  const funnelConversion = funnel.length >= 2 && funnel[0].unique_visitors > 0
    ? ((funnel[funnel.length - 1].unique_visitors / funnel[0].unique_visitors) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Overview</h1>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs bg-surface-page border border-border-default rounded-lg px-2 py-1.5 text-text-secondary cursor-pointer"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-brand-text transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Visitors" value={s.total_visitors ?? 0} icon={Users} sub={`${s.guest_visitors ?? 0} guest / ${s.auth_visitors ?? 0} auth`} />
        <StatCard label="Sessions" value={s.total_sessions ?? 0} icon={MousePointerClick} />
        <StatCard label="Avg Duration" value={formatDuration(s.avg_session_duration ?? 0)} icon={Clock} />
        <StatCard label="Prompts" value={s.prompts_submitted ?? 0} icon={MessageSquare} />
        <StatCard label="Diagrams" value={s.diagrams_generated ?? 0} icon={UserCheck} />
        <StatCard label="Exports" value={s.exports_completed ?? 0} icon={Download} />
      </div>

      {/* Feature usage stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Tutorial Steps" value={s.tutorial_interactions ?? 0} icon={BookOpen} sub="welcome card interactions" />
        <StatCard label="AI Generations" value={s.ai_generations ?? 0} icon={Bot} sub={`${s.ai_generation_success ?? 0} ok / ${s.ai_generation_errors ?? 0} err`} />
        <StatCard label="Sharing Actions" value={s.sharing_events ?? 0} icon={Share2} sub="invites, links, access" />
        <StatCard label="Settings Changes" value={s.settings_events ?? 0} icon={Settings} sub="toggles, dropdowns" />
        <StatCard label="UI Interactions" value={s.ui_interactions ?? 0} icon={MousePointerClick} sub="code view, etc." />
        <StatCard label="AI Error Rate" value={s.ai_generations ? `${(((s.ai_generation_errors ?? 0) / s.ai_generations) * 100).toFixed(1)}%` : '0%'} icon={AlertTriangle} sub={`${s.ai_generation_errors ?? 0} of ${s.ai_generations ?? 0}`} />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily visitors */}
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Daily Visitors</h3>
          <MiniLineChart data={data?.daily || []} />
        </div>

        {/* Funnel */}
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">
            Funnel <span className="text-brand-text">({funnelConversion}% conversion)</span>
          </h3>
          <div className="space-y-2">
            {funnel.map((row, i) => {
              const maxV = funnel[0]?.unique_visitors || 1;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-[120px] text-text-secondary capitalize">{row.stage.replace(/_/g, ' ')}</div>
                  <div className="flex-1 h-4 bg-surface-panel rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{
                        width: `${(row.unique_visitors / maxV) * 100}%`,
                        backgroundColor: i === funnel.length - 1 ? 'var(--success)' : 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-text-muted tabular-nums">{row.unique_visitors}</div>
                </div>
              );
            })}
            {funnel.length === 0 && <div className="text-xs text-text-muted py-4 text-center">No funnel data yet</div>}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Top Pages</h3>
          <BarChart data={data?.topPages || []} labelKey="page_path" valueKey="views" />
        </div>
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Top Clicks</h3>
          <BarChart data={data?.topClicks || []} labelKey="event_name" valueKey="clicks" />
        </div>
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Export Formats</h3>
          <BarChart data={data?.exportBreakdown || []} labelKey="format" valueKey="count" />
        </div>
      </div>

      {/* Feature usage breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Tutorial Engagement</h3>
          <BarChart data={data?.tutorialBreakdown || []} labelKey="event_name" valueKey="count" />
        </div>
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">AI Generation Events</h3>
          <BarChart data={data?.aiBreakdown || []} labelKey="event_name" valueKey="count" />
        </div>
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Sharing Activity</h3>
          <BarChart data={data?.sharingBreakdown || []} labelKey="event_name" valueKey="count" />
        </div>
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-3">Settings Changes</h3>
          <BarChart data={data?.settingsBreakdown || []} labelKey="event_name" valueKey="count" />
        </div>
      </div>
    </div>
  );
}
