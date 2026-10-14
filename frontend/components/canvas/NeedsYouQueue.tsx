'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, useStore } from 'reactflow';
import { Bell, BellOff } from 'lucide-react';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { attentionQueue, type AttentionItem } from '@/lib/diagram/projects/liveActivity';
import { useProjectLiveStore } from '@/store/projectLiveStore';

/**
 * "Needs you": the agent sessions waiting on the user, most urgent first
 * (blocked on a permission prompt, then finished turns), with how long each
 * has waited. Names match what each session's terminal shows ("Otter"), so
 * with ten agents you know which terminal to open. Optional desktop
 * notifications fire while the tab is in the background.
 */

const NOTIFY_KEY = 'archdraw-live-notify';
const MAX_SHOWN = 5;

function waited(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
}

function readNotify() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(NOTIFY_KEY) === 'on' && 'Notification' in window && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export function NeedsYouQueue({ className = '' }: { className?: string }) {
  const { showLiveActivity } = useCanvasView();
  const snapshot = useProjectLiveStore((s) => s.snapshot);
  const focused = useProjectLiveStore((s) => s.focusedSessionKey);
  const setFocused = useProjectLiveStore((s) => s.setFocusedSession);
  const nodeInternals = useStore((s) => s.nodeInternals);
  const [notify, setNotify] = useState(readNotify);
  const seen = useRef(new Map<string, string>());

  const queue = useMemo(() => (snapshot ? attentionQueue(snapshot.sessions, snapshot.serverTime) : []), [snapshot]);

  const where = (item: AttentionItem) => {
    const s = item.session;
    if (s.site) return `new ${s.site.label}`;
    const id = s.currentComponentId ?? s.aimComponentId;
    const label = id ? (nodeInternals.get(id)?.data as { label?: unknown } | undefined)?.label : null;
    return typeof label === 'string' ? label : null;
  };

  // Desktop notification when a session newly needs the user and this tab is hidden.
  useEffect(() => {
    const current = new Map(queue.map((item) => [item.session.sessionKey, `${item.reason}:${item.since}`]));
    if (notify && document.visibilityState !== 'visible') {
      for (const item of queue) {
        const key = item.session.sessionKey;
        if (seen.current.get(key) === current.get(key)) continue;
        try {
          const place = where(item);
          new Notification(item.reason === 'waiting' ? `${item.session.name} needs you` : `${item.session.name} finished`, {
            body: `${item.reason === 'waiting' ? 'Waiting for your permission' : 'Your turn'}${place ? ` · ${place}` : ''}`,
            tag: `archdraw-${key}`,
          });
        } catch {
          // notifications unavailable
        }
      }
    }
    seen.current = current;
    // `where` reads node labels only for the notification text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, notify]);

  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      try { localStorage.setItem(NOTIFY_KEY, 'off'); } catch { /* private mode */ }
      return;
    }
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    const on = permission === 'granted';
    setNotify(on);
    try { localStorage.setItem(NOTIFY_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  };

  if (!showLiveActivity || queue.length === 0) return null;
  // Waits use the server clock; the snapshot refreshes every couple of seconds.
  const serverNow = snapshot?.serverTime ?? 0;
  const waiting = queue.filter((i) => i.reason === 'waiting').length;

  return (
    <Panel position="top-center" className={`!m-0 ${className}`}>
      <div
        role="status"
        aria-label="Agent sessions that need you"
        className="flex max-w-[min(92vw,760px)] flex-wrap items-center gap-1.5 rounded-2xl border border-border/70 bg-background/90 px-2 py-1.5 text-[11.5px] shadow-lg backdrop-blur"
      >
        <span className={`px-1.5 font-semibold ${waiting ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
          Needs you · {queue.length}
        </span>
        {queue.slice(0, MAX_SHOWN).map((item) => {
          const s = item.session;
          const isFocused = focused === s.sessionKey;
          const place = where(item);
          return (
            <button
              key={s.sessionKey}
              onClick={() => setFocused(isFocused ? null : s.sessionKey)}
              aria-pressed={isFocused}
              title={`${s.name}: ${item.reason === 'waiting' ? 'waiting for your permission' : 'finished its turn'} — look for the terminal titled "${item.reason === 'waiting' ? `● ${s.name} needs you` : `✓ ${s.name} · your turn`}"`}
              className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
                isFocused ? 'border-foreground/40 bg-foreground/[0.07]' : 'border-border/70 hover:bg-foreground/[0.05]'
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <span className="font-semibold">{s.name}</span>
              <span className={item.reason === 'waiting' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                {item.reason === 'waiting' ? 'permission' : 'your turn'}
              </span>
              {place && <span className="truncate text-muted-foreground">· {place}</span>}
              <span className="shrink-0 tabular-nums text-muted-foreground">{waited(serverNow - item.since)}</span>
            </button>
          );
        })}
        {queue.length > MAX_SHOWN && <span className="px-1 text-muted-foreground">+{queue.length - MAX_SHOWN}</span>}
        <button
          onClick={() => void toggleNotify()}
          title={notify ? 'Desktop notifications on (click to turn off)' : 'Notify me when an agent needs me'}
          aria-pressed={notify}
          className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        </button>
      </div>
    </Panel>
  );
}
