import { describe, it, expect } from 'vitest';
import {
  ENDED_AFTER_MS,
  IDLE_AFTER_MS,
  MAX_UNMAPPED_PATHS,
  RECENT_CHANGE_MS,
  buildNodeActivity,
  deriveSessionStatus,
  mergeTouched,
  mergeUnmapped,
  parseTouched,
  sessionColor,
  statusForEvent,
  type LiveAgentSession,
} from '../liveActivity';

describe('deriveSessionStatus', () => {
  const now = 10_000_000;
  it('keeps a fresh active session active', () => {
    expect(deriveSessionStatus('active', now - 1000, now)).toBe('active');
  });
  it('turns stale sessions idle, then ended', () => {
    expect(deriveSessionStatus('active', now - IDLE_AFTER_MS, now)).toBe('idle');
    expect(deriveSessionStatus('idle', now - ENDED_AFTER_MS, now)).toBe('ended');
  });
  it('never revives an ended session', () => {
    expect(deriveSessionStatus('ended', now, now)).toBe('ended');
  });
});

describe('statusForEvent', () => {
  it('maps events to stored status', () => {
    expect(statusForEvent('start')).toBe('active');
    expect(statusForEvent('edit')).toBe('active');
    expect(statusForEvent('stop')).toBe('idle');
    expect(statusForEvent('end')).toBe('ended');
  });
});

describe('touched map', () => {
  it('parses only well-formed entries', () => {
    expect(parseTouched({ a: { count: 1, lastAt: 5 }, b: 'x', c: { count: 'y' } })).toEqual({ a: { count: 1, lastAt: 5 } });
    expect(parseTouched(null)).toEqual({});
    expect(parseTouched([])).toEqual({});
  });
  it('increments counts and updates lastAt', () => {
    const next = mergeTouched({ a: { count: 2, lastAt: 1 } }, ['a', 'b'], 9);
    expect(next).toEqual({ a: { count: 3, lastAt: 9 }, b: { count: 1, lastAt: 9 } });
  });
});

describe('mergeUnmapped', () => {
  it('puts newest first, dedupes and bounds the list', () => {
    expect(mergeUnmapped(['x', 'y'], ['y', 'z'])).toEqual(['y', 'z', 'x']);
    const many = Array.from({ length: 40 }, (_, i) => `f${i}`);
    expect(mergeUnmapped([], many)).toHaveLength(MAX_UNMAPPED_PATHS);
    expect(mergeUnmapped('garbage', ['a'])).toEqual(['a']);
  });
});

describe('sessionColor', () => {
  it('is stable for a key', () => {
    expect(sessionColor('abc')).toBe(sessionColor('abc'));
  });
});

describe('buildNodeActivity', () => {
  const base = {
    id: 'x', branch: null, intent: null, unmappedPaths: [], startedAt: 0, color: '#000', lastChange: null,
  };
  const now = 1_000_000;
  const sessions: LiveAgentSession[] = [
    { ...base, sessionKey: 'a', label: 'A', status: 'active' as const, currentComponentId: 'n1',
      touched: { n1: { count: 2, lastAt: now - 5_000 }, n2: { count: 1, lastAt: now - 600_000 } }, lastSeenAt: now },
    { ...base, sessionKey: 'b', label: 'B', status: 'idle' as const, currentComponentId: 'n2',
      touched: { n2: { count: 1, lastAt: now - 1_000 } }, lastSeenAt: now },
    { ...base, sessionKey: 'c', label: 'C', status: 'ended' as const, currentComponentId: 'n3',
      touched: { n3: { count: 1, lastAt: now } }, lastSeenAt: now },
  ];

  it('groups sessions per node, skipping ended sessions', () => {
    const activity = buildNodeActivity(sessions, now);
    expect(Object.keys(activity).sort()).toEqual(['n1', 'n2']);
    expect(activity.n1.sessions.map((s) => s.sessionKey)).toEqual(['a']);
    expect(activity.n1.sessions[0].isCurrent).toBe(true);
  });

  it('orders active sessions first and flags recent edits by active sessions only', () => {
    const activity = buildNodeActivity(sessions, now);
    expect(activity.n2.sessions.map((s) => s.sessionKey)).toEqual(['a', 'b']);
    expect(activity.n1.recent).toBe(true);
    expect(activity.n2.recent).toBe(false);
  });
});

describe('buildNodeActivity — added components', () => {
  const now = 1_000_000;
  const session = (key: string, at: number, added: string[]): LiveAgentSession => ({
    id: key, sessionKey: key, label: key.toUpperCase(), branch: null, status: 'ended', intent: null,
    currentComponentId: null, touched: {}, unmappedPaths: [], startedAt: 0, lastSeenAt: now, color: `#${key}`,
    lastChange: { added: added.map((id) => ({ id, label: id })), removed: [], renamed: [], at },
  });

  it('marks recently added components, even from ended sessions, newest change winning', () => {
    const activity = buildNodeActivity([session('aaa', now - 60_000, ['q']), session('bbb', now - 1_000, ['q', 'c'])], now);
    expect(activity.q.addedBy?.sessionKey).toBe('bbb');
    expect(activity.c.addedBy?.label).toBe('BBB');
    expect(activity.q.sessions).toEqual([]);
  });

  it('forgets old changes', () => {
    expect(buildNodeActivity([session('aaa', now - RECENT_CHANGE_MS, ['q'])], now)).toEqual({});
  });
});
