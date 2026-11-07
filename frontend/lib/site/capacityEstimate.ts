/**
 * Back-of-the-envelope capacity estimates for the system design calculator
 * (`/system-design-calculator`). Pure: inputs in, rounded figures out.
 */

export interface CapacityInput {
  dailyActiveUsers: number;
  /** Requests (reads + writes) one user makes per day. */
  requestsPerUserPerDay: number;
  /** Share of requests that are writes, 0–1. */
  writeShare: number;
  /** Peak traffic as a multiple of the daily average. */
  peakFactor: number;
  /** Average response size returned per request, KB. */
  responseKB: number;
  /** Data stored per write, KB. */
  storedPerWriteKB: number;
  /** How long data is kept, years. */
  retentionYears: number;
  /** Copies of each piece of data (replication factor). */
  replicas: number;
}

export interface CapacityEstimate {
  requestsPerDay: number;
  averageQps: number;
  peakQps: number;
  readQps: number;
  writeQps: number;
  storagePerDayGB: number;
  storagePerYearTB: number;
  totalStorageTB: number;
  egressMBps: number;
  peakEgressMBps: number;
}

const SECONDS_PER_DAY = 86_400;
const KB_PER_GB = 1024 * 1024;

const clamp = (n: number, min: number, max = Number.MAX_SAFE_INTEGER) => (Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min);

export function estimateCapacity(raw: CapacityInput): CapacityEstimate {
  const input = {
    dailyActiveUsers: clamp(raw.dailyActiveUsers, 0),
    requestsPerUserPerDay: clamp(raw.requestsPerUserPerDay, 0),
    writeShare: clamp(raw.writeShare, 0, 1),
    peakFactor: clamp(raw.peakFactor, 1, 100),
    responseKB: clamp(raw.responseKB, 0),
    storedPerWriteKB: clamp(raw.storedPerWriteKB, 0),
    retentionYears: clamp(raw.retentionYears, 0, 100),
    replicas: clamp(Math.round(raw.replicas), 1, 10),
  };
  const requestsPerDay = input.dailyActiveUsers * input.requestsPerUserPerDay;
  const averageQps = requestsPerDay / SECONDS_PER_DAY;
  const writesPerDay = requestsPerDay * input.writeShare;
  const storagePerDayGB = (writesPerDay * input.storedPerWriteKB * input.replicas) / KB_PER_GB;
  const egressMBps = (averageQps * input.responseKB) / 1024;
  return {
    requestsPerDay,
    averageQps,
    peakQps: averageQps * input.peakFactor,
    readQps: averageQps * (1 - input.writeShare),
    writeQps: averageQps * input.writeShare,
    storagePerDayGB,
    storagePerYearTB: (storagePerDayGB * 365) / 1024,
    totalStorageTB: (storagePerDayGB * 365 * input.retentionYears) / 1024,
    egressMBps,
    peakEgressMBps: egressMBps * input.peakFactor,
  };
}

/** 12_345_678 → "12.3M"; 950 → "950"; 0.42 → "0.42". */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 100) return Math.round(n).toLocaleString('en-US');
  if (abs >= 1) return n.toFixed(1);
  return n === 0 ? '0' : n.toFixed(2);
}

export const PRESETS: Array<{ id: string; label: string; input: CapacityInput }> = [
  { id: 'url-shortener', label: 'URL shortener', input: { dailyActiveUsers: 10_000_000, requestsPerUserPerDay: 10, writeShare: 0.01, peakFactor: 3, responseKB: 0.5, storedPerWriteKB: 0.5, retentionYears: 5, replicas: 3 } },
  { id: 'chat', label: 'Chat app', input: { dailyActiveUsers: 50_000_000, requestsPerUserPerDay: 100, writeShare: 0.4, peakFactor: 2, responseKB: 1, storedPerWriteKB: 0.2, retentionYears: 2, replicas: 3 } },
  { id: 'social-feed', label: 'Social feed', input: { dailyActiveUsers: 100_000_000, requestsPerUserPerDay: 50, writeShare: 0.02, peakFactor: 3, responseKB: 20, storedPerWriteKB: 1, retentionYears: 5, replicas: 3 } },
  { id: 'video', label: 'Video streaming', input: { dailyActiveUsers: 20_000_000, requestsPerUserPerDay: 30, writeShare: 0.001, peakFactor: 2.5, responseKB: 2048, storedPerWriteKB: 500_000, retentionYears: 10, replicas: 3 } },
];
