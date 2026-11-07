import { describe, expect, it } from 'vitest';
import { compact, estimateCapacity, PRESETS } from '@/lib/site/capacityEstimate';

describe('capacity estimate', () => {
  it('works out QPS, storage and bandwidth from users and usage', () => {
    const e = estimateCapacity({ dailyActiveUsers: 86_400, requestsPerUserPerDay: 10, writeShare: 0.1, peakFactor: 2, responseKB: 1024, storedPerWriteKB: 1024, retentionYears: 1, replicas: 1 });
    expect(e.averageQps).toBe(10);
    expect(e.peakQps).toBe(20);
    expect(e.writeQps).toBeCloseTo(1);
    expect(e.readQps).toBeCloseTo(9);
    // 86,400 writes a day × 1 MB = 84.375 GB/day.
    expect(e.storagePerDayGB).toBeCloseTo(84.375);
    expect(e.egressMBps).toBe(10);
  });

  it('clamps nonsense input instead of returning NaN', () => {
    const e = estimateCapacity({ dailyActiveUsers: -5, requestsPerUserPerDay: Number.NaN, writeShare: 3, peakFactor: 0, responseKB: 1, storedPerWriteKB: 1, retentionYears: 1, replicas: 0 });
    expect(Object.values(e).every(Number.isFinite)).toBe(true);
    expect(e.averageQps).toBe(0);
  });

  it('formats numbers compactly and has working presets', () => {
    expect(compact(12_345_678)).toBe('12.3M');
    expect(compact(950)).toBe('950');
    expect(compact(0.42)).toBe('0.42');
    for (const p of PRESETS) expect(estimateCapacity(p.input).averageQps).toBeGreaterThan(0);
  });
});
