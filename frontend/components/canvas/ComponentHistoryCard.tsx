'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, useStore } from 'reactflow';
import { X } from 'lucide-react';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { componentScope, summarizeFiles, type ComponentHistoryEntry } from '@/lib/diagram/projects/componentHistory';
import { sessionColor } from '@/lib/diagram/projects/liveActivity';
import { useProjectLiveStore } from '@/store/projectLiveStore';

/**
 * "Who touched this and why": the history of the component clicked on a live
 * project map. Each entry is one session's bout of work on it (name, what it
 * said it was doing, how many edits, which files) or the session that added
 * it; sessions on it right now are listed first. Opened from the map, closed
 * with ×, Escape or a click on the empty canvas.
 */

/** Refetch while open so a running bout's edits and new sessions show up. */
const REFRESH_MS = 8_000;

interface HistoryResponse {
  entries: ComponentHistoryEntry[];
  serverTime: number;
}

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function when(entry: ComponentHistoryEntry, now: number) {
  const sameDay = new Date(entry.lastAt).toDateString() === new Date(now).toDateString();
  const day = sameDay ? '' : `${new Date(entry.lastAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} `;
  const span = entry.lastAt - entry.startedAt >= 60_000 ? `${clock(entry.startedAt)}–${clock(entry.lastAt)}` : clock(entry.lastAt);
  return `${day}${span}`;
}

function labelOf(data: unknown, fallback: string) {
  const label = (data as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' && label.trim() ? label.replace(/<br\s*\/?>.*$/i, '') : fallback;
}

export function ComponentHistoryCard({ historyUrl, className = '' }: {
  /** History endpoint of this host (owner route or watch link). */
  historyUrl: string;
  className?: string;
}) {
  const { showLiveActivity } = useCanvasView();
  const componentId = useProjectLiveStore((s) => s.historyComponentId);
  const openHistory = useProjectLiveStore((s) => s.openHistory);
  const level = useProjectLiveStore((s) => s.level);
  const snapshot = useProjectLiveStore((s) => s.snapshot);
  const focused = useProjectLiveStore((s) => s.focusedSessionKey);
  const setFocused = useProjectLiveStore((s) => s.setFocusedSession);
  const nodeInternals = useStore((s) => s.nodeInternals);
  const [data, setData] = useState<{ key: string; body: HistoryResponse } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = componentId ? `${historyUrl}|${level}|${componentId}` : null;

  useEffect(() => {
    if (!componentId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const url = `${historyUrl}?component=${encodeURIComponent(componentId)}&level=${level}`;
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setData({ key: `${historyUrl}|${level}|${componentId}`, body: (await res.json()) as HistoryResponse });
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
      if (!controller.signal.aborted && document.visibilityState === 'visible') timer = setTimeout(load, REFRESH_MS);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [componentId, historyUrl, level]);

  useEffect(() => {
    if (!componentId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') openHistory(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [componentId, openHistory]);

  const node = componentId ? nodeInternals.get(componentId) : undefined;
  const scope = useMemo(
    () => (componentId ? new Set(componentScope([...nodeInternals.values()], componentId)) : new Set<string>()),
    [componentId, nodeInternals],
  );
  const working = useMemo(() => (snapshot?.sessions ?? []).filter((s) => {
    if (s.status !== 'active') return false;
    const at = level === 'detail' ? s.detailComponentId ?? s.currentComponentId : s.currentComponentId;
    return at !== null && scope.has(at);
  }), [snapshot, level, scope]);

  if (!showLiveActivity || !componentId || !node) return null;

  const title = labelOf(node.data, componentId);
  const body = data?.key === key ? data.body : null;
  const entries = body?.entries ?? [];
  const now = body?.serverTime ?? 0;
  const colorOf = (sessionKey: string) =>
    snapshot?.sessions.find((s) => s.sessionKey === sessionKey)?.color ?? sessionColor(sessionKey);
  const sessionCount = new Set(entries.map((e) => e.sessionKey)).size;
  const isArea = node.type === 'groupNode';

  return (
    <Panel position="top-right" className={`!m-3 ${className}`}>
      <section
        aria-label={`History of ${title}`}
        className="flex max-h-[min(70vh,560px)] w-[min(92vw,320px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 text-[12px] shadow-xl backdrop-blur"
      >
        <header className="flex items-start gap-2 border-b border-border/60 px-3.5 pb-2.5 pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {isArea ? 'Area history' : 'Component history'}
              {sessionCount > 0 && ` · ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
            </p>
            <h2 className="truncate text-[14px] font-semibold text-foreground" title={title}>{title}</h2>
          </div>
          <button
            onClick={() => openHistory(null)}
            aria-label="Close history"
            className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {working.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {working.map((s) => (
                <button
                  key={s.sessionKey}
                  onClick={() => setFocused(focused === s.sessionKey ? null : s.sessionKey)}
                  aria-pressed={focused === s.sessionKey}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 hover:bg-foreground/[0.05]"
                >
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ backgroundColor: s.color }} />
                    <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  </span>
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-muted-foreground">here now</span>
                </button>
              ))}
            </div>
          )}

          {!body && !failed && <p className="text-muted-foreground">Loading history…</p>}
          {failed && !body && <p className="text-muted-foreground">History is unavailable right now. Retrying…</p>}
          {body && entries.length === 0 && (
            <p className="leading-relaxed text-muted-foreground">
              No agent has edited {isArea ? 'this area' : 'this component'} yet. When a coding session edits its code, you will see
              who it was, what it was doing and when.
            </p>
          )}

          {entries.length > 0 && (
            <ol className="relative space-y-3.5 before:absolute before:bottom-1 before:left-[4px] before:top-1 before:w-px before:bg-border">
              {entries.map((entry) => {
                const where = (level === 'detail' ? entry.detailComponentId ?? entry.componentId : entry.componentId);
                const inside = where !== componentId ? labelOf(nodeInternals.get(where)?.data, '') : '';
                const name = entry.sessionName ?? 'An agent';
                const files = summarizeFiles(entry.files, entry.fileCount);
                return (
                  <li key={entry.id} className="relative pl-5">
                    <span
                      className={`absolute left-0 top-[5px] h-[9px] w-[9px] border-2 border-background ${entry.kind === 'added' ? 'rotate-45 rounded-[2px]' : 'rounded-full'}`}
                      style={{ backgroundColor: colorOf(entry.sessionKey) }}
                      aria-hidden
                    />
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-foreground">{name}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-[11px] text-muted-foreground">{when(entry, now)}</span>
                    </div>
                    {entry.kind === 'added' ? (
                      <p className="text-muted-foreground">Added {inside || (isArea ? 'a component here' : 'this component')} to the map</p>
                    ) : (
                      <>
                        {entry.intent && <p className="mt-0.5 leading-snug text-foreground/90">{entry.intent}</p>}
                        <p className="mt-0.5 text-muted-foreground" title={entry.files.length ? entry.files.join('\n') : undefined}>
                          {entry.edits} edit{entry.edits === 1 ? '' : 's'}
                          {inside && ` in ${inside}`}
                          {files && <span className="font-mono text-[11px]"> · {files}</span>}
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </Panel>
  );
}
