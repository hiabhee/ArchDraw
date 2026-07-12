'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

type PromptEvent = {
  id: number;
  visitor_id: string;
  event_type: string;
  page_path: string;
  payload: Record<string, unknown>;
  created_at: string;
  visitors: { anon_id: string; user_id: string | null; is_internal: boolean };
};

export default function PromptsPage() {
  const searchParams = useSearchParams();
  const internalParam = searchParams.get('internal') || '';
  const [prompts, setPrompts] = useState<PromptEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_type: 'prompt_submitted', limit: '100' });
      if (internalParam) params.set('internal', internalParam);
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      const data = await res.json();
      setPrompts(data.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [internalParam]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const filtered = prompts.filter((p) => {
    if (!search) return true;
    const text = String(p.payload?.prompt_text || '').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold shrink-0">Prompts</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full text-xs bg-[#0f1011] border border-[#18191a] rounded-lg px-3 py-2 text-[#d0d6e0] placeholder:text-[#62666d] focus:outline-none focus:border-[#1E90FF]"
          />
          <button
            onClick={fetchPrompts}
            className="p-1.5 rounded-lg border border-[#18191a] text-[#8a8f98] hover:text-[#f7f8f8] hover:border-[#1E90FF] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#18191a] bg-[#0f1011] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_80px_100px_80px] gap-2 py-2 px-3 border-b border-[#18191a] text-[10px] text-[#62666d] uppercase tracking-wider">
          <span>Time</span>
          <span>Prompt</span>
          <span>Length</span>
          <span>Visitor</span>
          <span>Type</span>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-auto">
          {filtered.length === 0 && !loading ? (
            <div className="py-12 text-center text-xs text-[#62666d]">
              {search ? 'No prompts match your search.' : 'No prompts submitted yet.'}
            </div>
          ) : (
            filtered.map((p) => {
              const isInternal = p.visitors?.is_internal;
              const isAuth = !!p.visitors?.user_id;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[140px_1fr_80px_100px_80px] gap-2 py-2.5 px-3 border-b border-[#18191a]/50 text-xs hover:bg-[#141516] transition-colors"
                >
                  <span className="text-[#8a8f98] tabular-nums">
                    {new Date(p.created_at).toLocaleString()}
                  </span>
                  <span className="text-[#d0d6e0] line-clamp-2">
                    {p.payload?.prompt_text || p.payload?.prompt_length
                      ? `(${p.payload.prompt_length} chars)`
                      : '--'}
                  </span>
                  <span className="text-[#8a8f98] tabular-nums">
                    {String(p.payload?.prompt_length ?? '--')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isInternal ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isAuth ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#8a8f98]/10 text-[#8a8f98]'
                    }`}>
                      {isInternal ? 'int' : isAuth ? 'auth' : 'guest'}
                    </span>
                    <span className="text-[#62666d] truncate">{p.visitors?.anon_id?.slice(0, 6)}</span>
                  </span>
                  <span className="text-[#8a8f98]">
                    {p.page_path}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
