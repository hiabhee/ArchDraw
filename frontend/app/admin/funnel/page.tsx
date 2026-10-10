'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, ArrowRight } from 'lucide-react';

type FunnelRow = { stage: string; sort_order: number; unique_visitors: number };

const STAGE_LABELS: Record<string, string> = {
  page_view: 'Landing',
  prompt_submitted: 'Prompt Submitted',
  diagram_generated: 'Diagram Generated',
  ai_generation_success: 'AI Generation Success',
  export: 'Exported',
};

export default function FunnelPage() {
  const searchParams = useSearchParams();
  const internalParam = searchParams.get('internal') || '';
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: '30' });
      if (internalParam) params.set('internal', internalParam);
      const res = await fetch(`/api/admin/stats?${params.toString()}`);
      const data = await res.json();
      setFunnel(data.funnel || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [internalParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxVisitors = funnel[0]?.unique_visitors || 1;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Funnel</h1>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-brand-text transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-panel p-6">
        <div className="text-xs text-text-muted mb-6">Last 30 days</div>

        {funnel.length === 0 && !loading ? (
          <div className="py-12 text-center text-xs text-text-muted">No funnel data yet.</div>
        ) : (
          <div className="space-y-4">
            {funnel.map((row, i) => {
              const pct = maxVisitors > 0 ? (row.unique_visitors / maxVisitors) * 100 : 0;
              const convFromPrev = i > 0 && funnel[i - 1].unique_visitors > 0
                ? ((row.unique_visitors / funnel[i - 1].unique_visitors) * 100).toFixed(1)
                : null;

              return (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: i === funnel.length - 1 ? 'var(--success)' : 'var(--accent)' }}>
                      {i + 1}
                    </div>
                    <span className="text-sm text-text-primary font-medium">
                      {STAGE_LABELS[row.stage] || row.stage}
                    </span>
                    <span className="text-xs text-text-muted ml-auto tabular-nums">
                      {row.unique_visitors.toLocaleString()} visitors
                    </span>
                  </div>

                  <div className="ml-7">
                    <div className="h-8 bg-surface-panel rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: i === funnel.length - 1 ? 'var(--success)' : 'var(--accent)',
                        }}
                      >
                        <span className="text-[10px] font-medium text-white">{pct.toFixed(1)}%</span>
                      </div>
                    </div>

                    {convFromPrev !== null && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span>{convFromPrev}% from previous step</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {funnel.length >= 2 && (
        <div className="rounded-xl border border-border-default bg-surface-panel p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-text-primary">
                {funnel[0]?.unique_visitors || 0}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Total Visitors</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-text">
                {funnel[1]?.unique_visitors || 0}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Prompted AI</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">
                {funnel[funnel.length - 1]?.unique_visitors || 0}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Exported</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
