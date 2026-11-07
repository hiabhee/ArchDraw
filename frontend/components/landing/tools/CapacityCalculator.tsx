'use client';

import { useMemo, useState } from 'react';
import { compact, estimateCapacity, PRESETS, type CapacityInput } from '@/lib/site/capacityEstimate';

const FIELDS: Array<{ key: keyof CapacityInput; label: string; hint: string; step: number; percent?: boolean }> = [
  { key: 'dailyActiveUsers', label: 'Daily active users', hint: 'People using it on a typical day', step: 1000 },
  { key: 'requestsPerUserPerDay', label: 'Requests per user per day', hint: 'Reads and writes together', step: 1 },
  { key: 'writeShare', label: 'Writes (% of requests)', hint: 'Posts, messages, uploads', step: 1, percent: true },
  { key: 'peakFactor', label: 'Peak ÷ average', hint: 'Busiest hour vs the daily average', step: 0.5 },
  { key: 'responseKB', label: 'Response size (KB)', hint: 'Average data returned per request', step: 1 },
  { key: 'storedPerWriteKB', label: 'Stored per write (KB)', hint: 'New data each write adds', step: 1 },
  { key: 'retentionYears', label: 'Retention (years)', hint: 'How long data is kept', step: 1 },
  { key: 'replicas', label: 'Replicas', hint: 'Copies of each piece of data', step: 1 },
];

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">{compact(value)}<span className="ml-1 text-sm font-medium text-text-secondary">{unit}</span></p>
    </div>
  );
}

/** Back-of-the-envelope estimator: users and usage in, QPS, storage and bandwidth out. */
export function CapacityCalculator() {
  const [input, setInput] = useState<CapacityInput>(PRESETS[2].input);
  const [preset, setPreset] = useState(PRESETS[2].id);
  const e = useMemo(() => estimateCapacity(input), [input]);

  const set = (key: keyof CapacityInput, raw: string, percent?: boolean) => {
    const n = Number(raw);
    setPreset('');
    setInput((prev) => ({ ...prev, [key]: percent ? n / 100 : n }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="rounded-2xl border border-border-default bg-surface-card p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setInput(p.input); setPreset(p.id); }} aria-pressed={preset === p.id}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${preset === p.id ? 'border-text-primary bg-text-primary text-surface-page' : 'border-border-default text-text-secondary hover:text-text-primary'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-text-primary">{f.label}</span>
              <input
                type="number"
                min={0}
                step={f.step}
                value={f.percent ? Math.round(input[f.key] * 1000) / 10 : input[f.key]}
                onChange={(ev) => set(f.key, ev.target.value, f.percent)}
                className="mt-1.5 w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm tabular-nums text-text-primary outline-none focus:border-border-strong"
              />
              <span className="mt-1 block text-xs text-text-muted">{f.hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4" aria-live="polite">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Average requests / second" value={e.averageQps} unit="QPS" />
          <Stat label="Peak requests / second" value={e.peakQps} unit="QPS" />
          <Stat label="Requests per day" value={e.requestsPerDay} unit="" />
          <Stat label="Reads / second" value={e.readQps} unit="QPS" />
          <Stat label="Writes / second" value={e.writeQps} unit="QPS" />
          <Stat label="New storage per day" value={e.storagePerDayGB} unit="GB" />
          <Stat label="Storage per year" value={e.storagePerYearTB} unit="TB" />
          <Stat label="Total storage (retention)" value={e.totalStorageTB} unit="TB" />
          <Stat label="Peak outbound bandwidth" value={e.peakEgressMBps} unit="MB/s" />
        </div>
        <p className="text-xs leading-5 text-text-muted">
          Estimates: requests/day = users × requests per user; QPS = requests/day ÷ 86,400; storage = writes × size × replicas. Real systems also need headroom, indexes and backups.
        </p>
      </div>
    </div>
  );
}
