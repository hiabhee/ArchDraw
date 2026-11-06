'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Interactive demos embedded in engineering blog posts (`BlogSection.demo`).
 * Each is a small, self-contained model of a real behaviour described in the
 * post; numbers shown are derived from the measurements the post reports.
 */
export type BlogDemoId = 'render-work' | 'geometry-check' | 'session-bucket' | 'hook-timeline' | 'api-waterfall';

const BAD = 'hsl(10 62% 50%)';
const GOOD = 'hsl(150 55% 38%)';
const WARN = 'hsl(36 90% 45%)';
const ACCENT = 'hsl(220 72% 52%)';

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--background))] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[hsl(var(--border)/0.12)] bg-[hsl(var(--muted)/0.35)]">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
          Try it · {title}
        </span>
        {action}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-[hsl(var(--foreground))] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--foreground))]" />
      {label}
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, format, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-[hsl(var(--foreground))]">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32 accent-[hsl(var(--foreground))]" />
      <span className="font-mono tabular-nums w-14">{format(value)}</span>
    </label>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border)/0.14)] px-3 py-2">
      <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: tone === 'good' ? GOOD : tone === 'bad' ? BAD : undefined }}>{value}</div>
      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</div>
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
      Reset
    </button>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Main-thread route calculations while the canvas loads. */
function RenderWorkDemo() {
  const [nodes, setNodes] = useState(38);
  const [edges, setEdges] = useState(43);
  const [worker, setWorker] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  const [batch, setBatch] = useState(false);

  // One pass per node size report (or one batch), plus one when the plan lands.
  const pendingPasses = batch ? 1 : nodes;
  const passes = pendingPasses + (worker ? 1 : 0);
  // Before the plan arrives, each pass routes every edge (unless placeholders are drawn).
  const routes = placeholder ? 0 : pendingPasses * edges;
  // Each edge has two endpoints; each endpoint's node scores its sides per pass.
  const scorings = placeholder ? 0 : pendingPasses * 2 * edges;
  const note = !worker
    ? 'The worker fails to load, so the plan never arrives and every later render stays on the fallback too.'
    : !placeholder
      ? 'The worker plan arrives, but every pass before it routes all edges on the main thread.'
      : !batch
        ? 'No main-thread routing, but each node size report still re-renders every edge and handle.'
        : 'One pass for all size reports, cheap placeholders, one plan from the worker. This is what shipped.';

  return (
    <Panel title="main-thread work during load" action={<ResetButton onClick={() => { setNodes(38); setEdges(43); setWorker(false); setPlaceholder(false); setBatch(false); }} />}>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Slider label="Nodes" value={nodes} min={10} max={150} format={String} onChange={setNodes} />
        <Slider label="Edges" value={edges} min={10} max={200} format={String} onChange={setEdges} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle label="Worker loads" checked={worker} onChange={setWorker} />
        <Toggle label="Placeholder while pending" checked={placeholder} onChange={setPlaceholder} />
        <Toggle label="Batch size updates" checked={batch} onChange={setBatch} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat value={fmt(passes)} label="render passes" />
        <Stat value={fmt(routes)} label="full routes on main thread" tone={routes > 500 ? 'bad' : 'good'} />
        <Stat value={fmt(scorings)} label="handle side scorings" tone={scorings > 500 ? 'bad' : 'good'} />
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{note}</p>
    </Panel>
  );
}

/** Route validation with and without the endpoint groups excluded. */
function GeometryCheckDemo() {
  const [fixed, setFixed] = useState(false);
  const groupStroke = fixed ? 'hsl(var(--muted-foreground))' : BAD;
  return (
    <Panel title="route validation" action={<Toggle label="Skip endpoint groups" checked={fixed} onChange={setFixed} />}>
      <svg viewBox="0 0 640 220" className="w-full h-auto text-[hsl(var(--foreground))]" role="img" aria-label="An edge from a node in the clients group to a node in the pages group">
        <rect x="20" y="25" width="230" height="170" rx="10" fill="none" stroke={groupStroke} strokeWidth="2" />
        <text x="34" y="48" fontFamily="ui-monospace, monospace" fontSize="13" fill="currentColor">clients (group)</text>
        <rect x="390" y="25" width="230" height="170" rx="10" fill="none" stroke={groupStroke} strokeWidth="2" />
        <text x="404" y="48" fontFamily="ui-monospace, monospace" fontSize="13" fill="currentColor">pages (group)</text>
        <rect x="60" y="90" width="140" height="56" rx="8" fill="hsl(var(--muted))" stroke={ACCENT} />
        <text x="130" y="123" textAnchor="middle" fontSize="15" fill="currentColor">browser</text>
        <rect x="440" y="90" width="140" height="56" rx="8" fill="hsl(var(--muted))" stroke={ACCENT} />
        <text x="510" y="123" textAnchor="middle" fontSize="15" fill="currentColor">editor</text>
        <path d="M200 118 H 438" fill="none" stroke={fixed ? ACCENT : WARN} strokeWidth="2.5" strokeDasharray={fixed ? undefined : '8 3 2 3'} />
        {!fixed && <circle cx="250" cy="118" r="9" fill="none" stroke={BAD} strokeWidth="2.5" />}
        {!fixed && <circle cx="390" cy="118" r="9" fill="none" stroke={BAD} strokeWidth="2.5" />}
      </svg>
      <p className="font-mono text-xs text-[hsl(var(--foreground))]">
        {fixed ? (
          <>excluded = {'{browser, editor, clients, pages}'} → violations: <strong style={{ color: GOOD }}>0</strong> · status: ok</>
        ) : (
          <>excluded = {'{browser, editor}'} → violations: <strong style={{ color: BAD }}>OBSTACLE_INTERSECTION clients, pages</strong> · status: invalid</>
        )}
      </p>
    </Panel>
  );
}

/** The 20-per-minute bucket on /get-session that signed users out. */
function SessionBucketDemo() {
  const [used, setUsed] = useState(0);
  const [signedIn, setSignedIn] = useState(true);
  const [exempt, setExempt] = useState(false);
  const [log, setLog] = useState<Array<{ text: string; ok: boolean }>>([
    { text: 'Click "Hard refresh". Each refresh reads the session twice (load + focus).', ok: true },
  ]);
  const counter = useRef(0);
  const state = useRef({ used: 0, signedIn: true });

  const refresh = (times: number) => {
    const lines: Array<{ text: string; ok: boolean }> = [];
    for (let t = 0; t < times; t++) {
      for (const why of ['load', 'focus']) {
        counter.current += 1;
        const n = counter.current;
        if (exempt) {
          lines.push({ text: `#${n} GET /get-session (${why}) → 200, not limited`, ok: true });
        } else if (state.current.used < 20) {
          state.current.used += 1;
          lines.push({ text: `#${n} GET /get-session (${why}) → 200  [${state.current.used}/20]`, ok: true });
        } else {
          lines.push({ text: `#${n} GET /get-session (${why}) → 429 Too Many Requests`, ok: false });
          if (state.current.signedIn) {
            state.current.signedIn = false;
            lines.push({ text: '   client: data = null → treated as a guest. Sign in again.', ok: false });
          }
        }
      }
    }
    setUsed(state.current.used);
    setSignedIn(state.current.signedIn);
    setLog((prev) => [...prev, ...lines].slice(-60));
  };
  const reset = () => {
    counter.current = 0;
    state.current = { used: 0, signedIn: true };
    setUsed(0); setSignedIn(true);
    setLog([{ text: 'Bucket emptied.', ok: true }]);
  };

  return (
    <Panel
      title="/get-session bucket (20 per 60 s)"
      action={
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ color: signedIn ? GOOD : BAD, background: signedIn ? 'hsl(150 55% 38% / 0.12)' : 'hsl(10 62% 50% / 0.12)' }}>
          {signedIn ? 'signed in' : 'signed out'}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => refresh(1)} className="rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-3 py-1.5 text-xs font-semibold">Hard refresh</button>
        <button onClick={() => refresh(5)} className="rounded-md border border-[hsl(var(--border)/0.3)] px-3 py-1.5 text-xs font-semibold">Refresh ×5</button>
        <button onClick={reset} className="rounded-md border border-[hsl(var(--border)/0.3)] px-3 py-1.5 text-xs font-semibold">Reset</button>
        <Toggle
          label="Exempt /get-session"
          checked={exempt}
          onChange={(value) => {
            setExempt(value);
            if (value) { state.current.signedIn = true; setSignedIn(true); }
          }}
        />
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }} aria-label={`${used} of 20 requests used`}>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="h-4 rounded-sm border border-[hsl(var(--border)/0.2)]" style={{ background: i < used ? ACCENT : 'hsl(var(--muted)/0.5)' }} />
        ))}
      </div>
      <div className="h-32 overflow-y-auto rounded-md bg-[hsl(var(--muted)/0.35)] px-3 py-2 font-mono text-[11px] leading-relaxed" aria-live="polite">
        {log.map((line, i) => (
          <div key={i} style={{ color: line.ok ? undefined : BAD }}>{line.text}</div>
        ))}
      </div>
    </Panel>
  );
}

/** What the SessionStart hook does at a given server latency. */
function HookTimelineDemo() {
  const [latency, setLatency] = useState(3000);
  const [background, setBackground] = useState(false);
  const SCALE = 8000;
  const pct = (ms: number) => `${(Math.min(Math.max(ms, 0), SCALE) / SCALE) * 100}%`;

  const model = useMemo(() => {
    if (!background) {
      const cut = 1500;
      const ok = latency <= cut;
      return {
        wait: Math.min(latency, cut),
        rows: [
          { label: 'report', start: 0, len: Math.min(latency, cut), color: ok ? GOOD : BAD, text: ok ? 'POST /activity ✓' : 'aborted at 1.5 s' },
          { label: 'map', start: 0, len: Math.min(latency, cut), color: ok ? GOOD : BAD, text: ok ? 'GET map ✓' : 'aborted' },
        ],
        report: ok, note: ok ? 'real count' : '"0 components"', noteTone: ok ? 'good' as const : 'bad' as const,
      };
    }
    const mapCut = 4000;
    const mapOk = latency <= mapCut;
    return {
      wait: Math.min(latency, mapCut) + 60,
      rows: [
        { label: 'report', start: 60, len: latency, color: GOOD, text: 'background POST ✓' },
        { label: 'map', start: 0, len: Math.min(latency, mapCut), color: mapOk ? GOOD : WARN, text: mapOk ? 'GET map ✓' : 'gave up at 4 s' },
      ],
      report: latency <= 15000, note: mapOk ? 'real count' : '"not loaded yet"', noteTone: mapOk ? 'good' as const : undefined,
    };
  }, [latency, background]);

  const rows = [{ label: 'agent', start: 0, len: model.wait, color: WARN, text: 'waits', tail: true }, ...model.rows];
  return (
    <Panel title="SessionStart hook" action={<Toggle label="Background delivery" checked={background} onChange={setBackground} />}>
      <Slider label="Server latency" value={latency} min={200} max={6000} step={100} format={(v) => `${(v / 1000).toFixed(1)} s`} onChange={setLatency} />
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[64px_1fr] items-center gap-2 text-xs">
            <span className="text-[hsl(var(--muted-foreground))]">{row.label}</span>
            <div className="relative h-5 border-b border-dashed border-[hsl(var(--border)/0.25)]">
              <div className="absolute top-0.5 h-4 rounded-sm px-1.5 font-mono text-[10px] leading-4 text-white overflow-hidden whitespace-nowrap transition-all" style={{ left: pct(row.start), width: pct(row.len), background: row.color }}>
                {row.text}
              </div>
              {'tail' in row && (
                <div className="absolute top-0.5 h-4 rounded-sm px-1.5 font-mono text-[10px] leading-4 text-white overflow-hidden whitespace-nowrap transition-all" style={{ left: pct(row.len), width: pct(SCALE - row.len), background: ACCENT }}>
                  works
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <span />
          <div className="flex justify-between font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><span>0 s</span><span>2 s</span><span>4 s</span><span>6 s</span><span>8 s</span></div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat value={`${(model.wait / 1000).toFixed(1)} s`} label="agent waits" />
        <Stat value={model.report ? 'arrives' : 'lost'} label="session report" tone={model.report ? 'good' : 'bad'} />
        <Stat value={model.note} label="start note says" tone={model.noteTone} />
      </div>
    </Panel>
  );
}

/** POST /activity request waterfall with each server fix as a switch. */
function ApiWaterfallDemo() {
  const [rtt, setRtt] = useState(320);
  const [breaker, setBreaker] = useState(false);
  const [lightSelect, setLightSelect] = useState(false);
  const [throttle, setThrottle] = useState(false);

  const steps = [
    { name: 'rate limit', ms: breaker ? 1 : 3000, fixed: breaker as boolean | undefined },
    { name: 'canvas lookup', ms: (lightSelect ? 1 : 5) * rtt, fixed: lightSelect as boolean | undefined },
    { name: 'credential', ms: (throttle ? 1 : 4) * rtt, fixed: throttle as boolean | undefined },
    { name: 'session read', ms: rtt, fixed: undefined },
    { name: 'session upsert', ms: rtt, fixed: undefined },
  ];
  const total = steps.reduce((sum, s) => sum + s.ms, 0);
  const scale = Math.max(total, 7000);
  let offset = 0;

  return (
    <Panel title="POST /activity waterfall" action={<ResetButton onClick={() => { setRtt(320); setBreaker(false); setLightSelect(false); setThrottle(false); }} />}>
      <Slider label="DB round trip" value={rtt} min={5} max={400} step={5} format={(v) => `${v} ms`} onChange={setRtt} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle label="Redis circuit breaker" checked={breaker} onChange={setBreaker} />
        <Toggle label="Light canvas select" checked={lightSelect} onChange={setLightSelect} />
        <Toggle label="Throttle lastUsedAt write" checked={throttle} onChange={setThrottle} />
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => {
          const left = offset;
          offset += step.ms;
          const color = step.fixed === undefined ? ACCENT : step.fixed ? GOOD : BAD;
          return (
            <div key={step.name} className="grid grid-cols-[96px_1fr_64px] sm:grid-cols-[120px_1fr_72px] items-center gap-2 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">{step.name}</span>
              <div className="relative h-4 rounded-sm bg-[hsl(var(--muted)/0.4)] overflow-hidden">
                <div className="absolute top-0 bottom-0 rounded-sm transition-all" style={{ left: `${(left / scale) * 100}%`, width: `${Math.max((step.ms / scale) * 100, 0.4)}%`, background: color }} />
              </div>
              <span className="font-mono tabular-nums text-right">{fmt(step.ms)} ms</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-[hsl(var(--border)/0.12)] pt-2 text-sm">
        <span>Total</span>
        <span className="font-mono tabular-nums font-semibold">{(total / 1000).toFixed(2)} s</span>
      </div>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        Model: round-trip counts fitted to our measurements at 320 ms (canvas ≈ 5, credential ≈ 4, session 2). It gives 6.5 s before and 1.3 s after; we measured 7.0 s and 1.4 s.
      </p>
    </Panel>
  );
}

const DEMOS: Record<BlogDemoId, () => ReactNode> = {
  'render-work': RenderWorkDemo,
  'geometry-check': GeometryCheckDemo,
  'session-bucket': SessionBucketDemo,
  'hook-timeline': HookTimelineDemo,
  'api-waterfall': ApiWaterfallDemo,
};

export function BlogDemo({ id }: { id: BlogDemoId }) {
  const Demo = DEMOS[id];
  return Demo ? <Demo /> : null;
}
