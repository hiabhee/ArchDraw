import { describe, expect, it } from 'vitest';
import type { LiveAgentSession } from '../liveActivity';
import { componentSpend, highSpendSessions } from '../sessionInsights';
import { emptyUsage } from '../sessionUsage';

const NOW = 1_000_000;

function session(key: string, over: Partial<LiveAgentSession> = {}): LiveAgentSession {
  return {
    id: key, sessionKey: key, name: key, label: 'repo', branch: null, status: 'active', intent: null,
    currentComponentId: null, touched: {}, unmappedPaths: [], startedAt: 0, lastSeenAt: NOW, color: '#fff',
    lastChange: null, lastAction: 'edit', lastActionAt: NOW, aimComponentId: null, site: null,
    mappedHits: 0, unmappedHits: 0, detailComponentId: null, ...over,
  };
}

const spend = (output: number) => ({ ...emptyUsage(), output });

describe('highSpendSessions', () => {
  // claude-opus-5-5 output is $20 per million tokens.
  const priced = (key: string, outputTokens: number) => session(key, { model: 'claude-opus-5-5', usage: spend(outputTokens) });
  it('flags a lone session over the floor', () => {
    expect([...highSpendSessions([priced('a', 300_000)])]).toEqual(['a']); // $6
    expect(highSpendSessions([priced('a', 100_000)]).size).toBe(0); // $2
  });
  it('flags a session far above its peers and not an evenly busy group', () => {
    expect([...highSpendSessions([priced('a', 600_000), priced('b', 50_000), priced('c', 60_000)])]).toEqual(['a']);
    expect(highSpendSessions([priced('a', 300_000), priced('b', 280_000)]).size).toBe(0);
  });
  it('skips sessions without a known price', () => {
    expect(highSpendSessions([session('a', { model: 'mystery', usage: spend(9e9) })]).size).toBe(0);
  });
});

describe('componentSpend', () => {
  it('sums tokens and estimated cost per component across sessions', () => {
    const result = componentSpend([
      session('a', { model: 'claude-opus-5-5', usageByComponent: { api: spend(1e6), web: spend(1e5) } }),
      session('b', { model: 'claude-opus-5-5', usageByComponent: { api: spend(1e6) } }),
      session('c', { model: 'mystery', usageByComponent: { web: spend(10) } }),
    ]);
    expect(result.api).toEqual({ tokens: 2e6, usd: 40 });
    expect(result.web.tokens).toBe(1e5 + 10);
    expect(result.web.usd).toBeCloseTo(2, 6);
  });
});
