import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_LABEL,
  READ_RECENT_MS,
  RUN_RECENT_MS,
  actionForEvent,
  sessionActivity,
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
  assignDistinctColors,
  statusForEvent,
  SESSION_NAMES,
  attentionQueue,
  mapCoverage,
  sessionNameFor,
  type LiveAgentSession,
  sessionsForLevel,
  reuseNodeActivity,
  livePollBaseMs,
  LIVE_POLL_ACTIVE_MS,
  LIVE_POLL_QUIET_MS,
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
    lastAction: null, lastActionAt: null, aimComponentId: null, name: 'Otter', site: null, mappedHits: 0, unmappedHits: 0, detailComponentId: null,
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

  it('reuseNodeActivity keeps the previous map when a poll changes nothing', () => {
    const prev = buildNodeActivity(sessions, now);
    expect(reuseNodeActivity(prev, buildNodeActivity(sessions, now))).toBe(prev);
  });

  it('reuseNodeActivity keeps unchanged entries and replaces changed ones', () => {
    const prev = buildNodeActivity(sessions, now);
    const moved = sessions.map((s) => (s.sessionKey === 'b' ? { ...s, status: 'active' as const } : s));
    const next = reuseNodeActivity(prev, buildNodeActivity(moved, now));
    expect(next).not.toBe(prev);
    expect(next.n1).toBe(prev.n1);
    expect(next.n2).not.toBe(prev.n2);
    expect(next.n2.sessions.map((m) => m.status)).toEqual(['active', 'active']);
  });

  it('reuseNodeActivity drops nodes no session touches any more', () => {
    const prev = buildNodeActivity(sessions, now);
    const next = reuseNodeActivity(prev, buildNodeActivity(sessions.slice(0, 1), now));
    expect(next).not.toBe(prev);
    expect(next.n1).toBe(prev.n1);
  });
});

describe('livePollBaseMs', () => {
  it('polls fast while a session is active and slower otherwise', () => {
    expect(livePollBaseMs([{ status: 'idle' }, { status: 'active' }])).toBe(LIVE_POLL_ACTIVE_MS);
    expect(livePollBaseMs([{ status: 'idle' }, { status: 'ended' }])).toBe(LIVE_POLL_QUIET_MS);
    expect(livePollBaseMs([])).toBe(LIVE_POLL_QUIET_MS);
  });
});

describe('buildNodeActivity — added components', () => {
  const now = 1_000_000;
  const session = (key: string, at: number, added: string[]): LiveAgentSession => ({
    id: key, sessionKey: key, label: key.toUpperCase(), branch: null, status: 'ended', intent: null,
    currentComponentId: null, touched: {}, unmappedPaths: [], startedAt: 0, lastSeenAt: now, color: `#${key}`,
    lastAction: null, lastActionAt: null, aimComponentId: null, name: 'Otter', site: null, mappedHits: 0, unmappedHits: 0, detailComponentId: null,
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

describe('assignDistinctColors', () => {
  it('gives every session in a snapshot its own colour, earliest keeps its hash', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({ sessionKey: `k${i}`, startedAt: i, color: 'x' }));
    const out = assignDistinctColors(sessions);
    expect(new Set(out.map((s) => s.color)).size).toBe(8);
    expect(out[0].color).toBe(sessionColor('k0'));
    expect(out.map((s) => s.sessionKey)).toEqual(sessions.map((s) => s.sessionKey));
  });

  it('lets live sessions pick before ended ones', () => {
    const ended = Array.from({ length: 10 }, (_, i) => ({ sessionKey: `old${i}`, startedAt: i, color: 'x', status: 'ended' as const }));
    const live = Array.from({ length: 5 }, (_, i) => ({ sessionKey: `new${i}`, startedAt: 100 + i, color: 'x', status: 'active' as const }));
    const out = assignDistinctColors([...ended, ...live]);
    expect(new Set(out.slice(10).map((s) => s.color)).size).toBe(5);
  });
});

describe('sessionNameFor', () => {
  it('is stable per session and skips names other live sessions use', () => {
    const first = sessionNameFor('session-1');
    expect(sessionNameFor('session-1')).toBe(first);
    const second = sessionNameFor('session-1', new Set([first]));
    expect(second).not.toBe(first);
    expect(SESSION_NAMES).toContain(second);
  });

  it('gives ten sessions ten different names', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 10; i++) taken.add(sessionNameFor(`k${i}`, taken));
    expect(taken.size).toBe(10);
  });
});

describe('mapCoverage', () => {
  it('needs a few edited files before it reports anything', () => {
    expect(mapCoverage([{ mappedHits: 2, unmappedHits: 1 }])).toBeNull();
  });

  it('is the share of edited files that landed on a component', () => {
    expect(mapCoverage([{ mappedHits: 7, unmappedHits: 1 }, { mappedHits: 2, unmappedHits: 0 }])).toEqual({ percent: 90, total: 10 });
  });
});

describe('attentionQueue', () => {
  const now = 1_000_000;
  const s = (key: string, lastAction: LiveAgentSession['lastAction'], ago: number, status: LiveAgentSession['status'] = 'active') => ({
    id: key, sessionKey: key, name: key, label: key, branch: null, status, intent: null, currentComponentId: null, touched: {},
    unmappedPaths: [], startedAt: 0, lastSeenAt: now, color: '#000', lastChange: null, lastAction, lastActionAt: now - ago,
    aimComponentId: null, site: null, mappedHits: 0, unmappedHits: 0, detailComponentId: null,
  }) satisfies LiveAgentSession;

  it('lists permission requests first, longest waiting first, then finished turns', () => {
    const queue = attentionQueue([
      s('done-old', 'done', 60_000), s('wait-new', 'waiting', 5_000), s('busy', 'edit', 1_000),
      s('wait-old', 'waiting', 90_000), s('gone', 'waiting', 1_000, 'ended'), s('stale', 'done', 3_600_000),
    ], now);
    expect(queue.map((i) => i.session.sessionKey)).toEqual(['wait-old', 'wait-new', 'done-old']);
    expect(queue.map((i) => i.reason)).toEqual(['waiting', 'waiting', 'done']);
  });
});

describe('sessionsForLevel', () => {
  const sessions = [
    { sessionKey: 'a', currentComponentId: 'model', detailComponentId: 'model__trainer' },
    { sessionKey: 'b', currentComponentId: 'api', detailComponentId: null },
  ];
  it('keeps overview positions on the overview', () => {
    expect(sessionsForLevel(sessions, 'overview')).toBe(sessions);
  });
  it('puts sessions on their part of the detailed map, else on their component box', () => {
    expect(sessionsForLevel(sessions, 'detail').map((s) => s.currentComponentId)).toEqual(['model__trainer', 'api']);
  });
});

describe('sessionActivity', () => {
  const at = 1_000_000;
  const s = (lastAction: string | null, ago: number, status: 'active' | 'idle' | 'ended' = 'active') => ({ status, lastAction, lastActionAt: lastAction ? at - ago : null });

  it('names what the session is doing right now', () => {
    expect(sessionActivity(s('read', 5_000), at)).toBe('reading');
    expect(sessionActivity(s('run', 60_000), at)).toBe('running');
    expect(sessionActivity(s('edit', 5_000), at)).toBe('writing');
    expect(sessionActivity(s('start', 2_000), at)).toBe('starting');
    expect(ACTIVITY_LABEL.reading).toBe('reading files…');
    expect(ACTIVITY_LABEL.running).toBe('running commands…');
    expect(ACTIVITY_LABEL.writing).toBe('writing code…');
  });

  it('falls back to thinking once the last action is old, and keeps a long command running for minutes', () => {
    expect(sessionActivity(s('read', READ_RECENT_MS + 1), at)).toBe('thinking');
    expect(sessionActivity(s('edit', 31_000), at)).toBe('thinking');
    expect(sessionActivity(s('run', RUN_RECENT_MS - 1), at)).toBe('running');
    expect(sessionActivity(s('run', RUN_RECENT_MS + 1), at)).toBe('thinking');
    expect(sessionActivity(s(null, 0), at)).toBe('thinking');
  });

  it('puts the user first: permission, then their turn; idle and ended win over stale actions', () => {
    expect(sessionActivity(s('waiting', 3_600_000), at)).toBe('waiting');
    expect(sessionActivity(s('done', 60_000, 'idle'), at)).toBe('done');
    expect(sessionActivity(s('done', 3_600_000, 'idle'), at)).toBe('idle');
    expect(sessionActivity(s('run', 1_000, 'idle'), at)).toBe('idle');
    expect(sessionActivity(s('waiting', 1_000, 'ended'), at)).toBe('ended');
  });

  it('maps the new events: run changes the action, task only carries the task', () => {
    expect(actionForEvent('run')).toBe('run');
    expect(actionForEvent('task')).toBeNull();
  });
});
