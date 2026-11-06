import type { StructureChange } from './structureDiff';
import type { TokenUsage, UsageByComponent } from './sessionUsage';

/**
 * Pure helpers for live agent activity on a project canvas: merging edit
 * events into a session's touched-component map and deriving its status.
 */

export type AgentSessionStatus = 'active' | 'idle' | 'ended';

/** `run`: a shell command started (never its text). `task`: the agent moved to another to-do item (carries it as `intent`). */
export type ActivityEvent = 'start' | 'read' | 'run' | 'edit' | 'task' | 'aim' | 'wait' | 'stop' | 'end';

/**
 * What a session did last; drives its figure on the canvas. `run`: started a
 * shell command; `waiting`: asked for permission; `done`: finished its turn
 * (the user's move).
 */
export type SessionAction = 'start' | 'read' | 'run' | 'edit' | 'waiting' | 'done';

const ACTION_FOR_EVENT: Partial<Record<ActivityEvent, SessionAction>> = {
  start: 'start',
  read: 'read',
  run: 'run',
  edit: 'edit',
  wait: 'waiting',
  stop: 'done',
};

/** Null when the event does not change the action (task, aim, end). */
export function actionForEvent(event: ActivityEvent): SessionAction | null {
  return ACTION_FOR_EVENT[event] ?? null;
}

export interface TouchedEntry {
  count: number;
  /** Epoch ms of the last edit that touched this component. */
  lastAt: number;
}

export type TouchedMap = Record<string, TouchedEntry>;

/** No event for this long → a session that was active shows as idle. */
export const IDLE_AFTER_MS = 2 * 60 * 1000;
/** No event for this long → any session shows as ended. */
export const ENDED_AFTER_MS = 30 * 60 * 1000;
/** An edit this recent makes its component pulse on the canvas. */
export const RECENT_EDIT_MS = 30 * 1000;
/** A component an agent added stays highlighted this long. */
export const RECENT_CHANGE_MS = 2 * 60 * 1000;
/** Bound on remembered unmapped paths per session. */
export const MAX_UNMAPPED_PATHS = 25;

export function deriveSessionStatus(
  stored: AgentSessionStatus,
  lastSeenAt: number,
  now: number,
): AgentSessionStatus {
  if (stored === 'ended') return 'ended';
  const age = now - lastSeenAt;
  if (age >= ENDED_AFTER_MS) return 'ended';
  if (age >= IDLE_AFTER_MS) return 'idle';
  return stored;
}

/** Status a session is stored with after receiving `event`. */
/** A read this recent still shows as "reading files…". */
export const READ_RECENT_MS = 20_000;
/** Commands can run for minutes (tests, builds): "running commands…" until the next action. */
export const RUN_RECENT_MS = 3 * 60 * 1000;
/** "Your turn" stays up this long after a session finished. */
export const DONE_RECENT_MS = 10 * 60 * 1000;
/** A session this fresh shows as "starting…". */
export const START_RECENT_MS = 9_000;

/** What a session is doing right now, in the words the map and panels show. */
export type SessionActivity = 'starting' | 'reading' | 'running' | 'writing' | 'thinking' | 'waiting' | 'done' | 'idle' | 'ended';

export const ACTIVITY_LABEL: Record<SessionActivity, string> = {
  starting: 'starting…',
  reading: 'reading files…',
  running: 'running commands…',
  writing: 'writing code…',
  thinking: 'thinking…',
  waiting: 'needs you',
  done: 'your turn',
  idle: 'idle',
  ended: 'ended',
};

export function sessionActivity(
  s: { status: AgentSessionStatus; lastAction?: SessionAction | string | null; lastActionAt?: number | null },
  now: number,
): SessionActivity {
  if (s.status === 'ended') return 'ended';
  const age = s.lastActionAt != null ? now - s.lastActionAt : Infinity;
  if (s.lastAction === 'waiting') return 'waiting';
  if (s.lastAction === 'done' && age < DONE_RECENT_MS) return 'done';
  if (s.status === 'idle') return 'idle';
  if (s.lastAction === 'edit' && age < RECENT_EDIT_MS) return 'writing';
  if (s.lastAction === 'read' && age < READ_RECENT_MS) return 'reading';
  if (s.lastAction === 'run' && age < RUN_RECENT_MS) return 'running';
  if (s.lastAction === 'start' && age < START_RECENT_MS) return 'starting';
  return 'thinking';
}

export function statusForEvent(event: ActivityEvent): AgentSessionStatus {
  if (event === 'end') return 'ended';
  if (event === 'stop') return 'idle';
  return 'active';
}

export function parseTouched(value: unknown): TouchedMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: TouchedMap = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const { count, lastAt } = entry as Partial<TouchedEntry>;
    if (typeof count === 'number' && typeof lastAt === 'number') result[id] = { count, lastAt };
  }
  return result;
}

export function mergeTouched(touched: TouchedMap, componentIds: readonly string[], at: number): TouchedMap {
  if (componentIds.length === 0) return touched;
  const next: TouchedMap = { ...touched };
  for (const id of componentIds) {
    const prev = next[id];
    next[id] = { count: (prev?.count ?? 0) + 1, lastAt: at };
  }
  return next;
}

/** Newest-first, de-duplicated, bounded list of paths no component claims. */
export function mergeUnmapped(existing: unknown, paths: readonly string[]): string[] {
  const prior = Array.isArray(existing) ? existing.filter((p): p is string => typeof p === 'string') : [];
  const merged = [...paths, ...prior.filter((p) => !paths.includes(p))];
  return Array.from(new Set(merged)).slice(0, MAX_UNMAPPED_PATHS);
}

/** Stable, readable color per session key (independent of list order). */
/** Ten clearly separable hues on light and dark canvases. */
export const SESSION_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316',
  '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#facc15',
] as const;

export function sessionColor(sessionKey: string): string {
  let hash = 0;
  for (let i = 0; i < sessionKey.length; i++) hash = (hash * 31 + sessionKey.charCodeAt(i)) | 0;
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

/**
 * Give the sessions of one snapshot different colours (up to the palette size).
 * Live sessions pick first (ended ones only fill in), earliest first; a session
 * keeps its hashed colour unless taken, else gets the first unused hue. Order
 * of the list is preserved.
 */
export function assignDistinctColors<T extends { sessionKey: string; startedAt: number; color: string; status?: AgentSessionStatus }>(sessions: readonly T[]): T[] {
  const used = new Set<string>();
  const rank = (s: T) => (s.status === 'ended' ? 1 : 0);
  const byStart = [...sessions].sort((a, b) => rank(a) - rank(b) || a.startedAt - b.startedAt || a.sessionKey.localeCompare(b.sessionKey));
  const colors = new Map<string, string>();
  for (const s of byStart) {
    const preferred = sessionColor(s.sessionKey);
    const color = !used.has(preferred) ? preferred : SESSION_COLORS.find((c) => !used.has(c)) ?? preferred;
    used.add(color);
    colors.set(s.sessionKey, color);
  }
  return sessions.map((s) => ({ ...s, color: colors.get(s.sessionKey) ?? s.color }));
}

/**
 * Session names: short, distinct words that read well on the map and in a
 * terminal ("Otter needs you"). A session keeps its name; live sessions on one
 * canvas never share one while names remain.
 */
export const SESSION_NAMES = [
  'Otter', 'Fox', 'Owl', 'Lynx', 'Panda', 'Koala', 'Tiger', 'Wolf', 'Bear', 'Hawk',
  'Seal', 'Moose', 'Bison', 'Crane', 'Heron', 'Raven', 'Gecko', 'Lemur', 'Llama', 'Yak',
  'Zebra', 'Hippo', 'Rhino', 'Camel', 'Badger', 'Beaver', 'Cobra', 'Dingo', 'Eagle', 'Falcon',
  'Ferret', 'Ibis', 'Jaguar', 'Kiwi', 'Mole', 'Newt', 'Orca', 'Puffin', 'Quail', 'Robin',
  'Shark', 'Toucan', 'Viper', 'Walrus', 'Wombat', 'Bat', 'Crab', 'Dove', 'Elk', 'Finch',
] as const;

function hashKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** The session's preferred name, or the next one not in `taken`. */
export function sessionNameFor(sessionKey: string, taken: ReadonlySet<string> = new Set()): string {
  const start = hashKey(sessionKey) % SESSION_NAMES.length;
  for (let i = 0; i < SESSION_NAMES.length; i++) {
    const name = SESSION_NAMES[(start + i) % SESSION_NAMES.length];
    if (!taken.has(name)) return name;
  }
  return `${SESSION_NAMES[start]} ${sessionKey.replace(/[^a-z0-9]/gi, '').slice(0, 3)}`;
}

/**
 * New code no component owns yet, shown as a construction site next to
 * `anchorId`. `key` groups sessions working in the same place.
 */
export interface LiveSite {
  key: string;
  label: string;
  anchorId: string | null;
}

/** One session as returned by `GET /api/projects/:canvasId/live`. */
export interface LiveAgentSession {
  id: string;
  sessionKey: string;
  /** Short display name, also shown in the session's terminal ("Otter"). */
  name: string;
  label: string;
  branch: string | null;
  status: AgentSessionStatus;
  intent: string | null;
  currentComponentId: string | null;
  touched: TouchedMap;
  unmappedPaths: string[];
  startedAt: number;
  lastSeenAt: number;
  color: string;
  /** Last structural diagram change this session published. */
  lastChange: StructureChange | null;
  lastAction: SessionAction | null;
  lastActionAt: number | null;
  /** Component the session's task points at (before it reads or edits anything). */
  aimComponentId: string | null;
  /** Editing new code that is not on the diagram yet. */
  site: LiveSite | null;
  /** Edited source files that were / were not on a component. */
  mappedHits: number;
  unmappedHits: number;
  /** Part of the detailed map the session is at (null: its component). */
  detailComponentId: string | null;
  /** Model the session runs on and the tokens it has used so far (absent before the first report). */
  model?: string | null;
  usage?: TokenUsage;
  /** Tokens by the component the session was at when it spent them. */
  usageByComponent?: UsageByComponent;
}

/** Below this many edited files a coverage figure means little. */
export const MIN_COVERAGE_SAMPLE = 5;

/**
 * Share of the source files agents edited that landed on a component: how
 * well the diagram matches where the work happens. Null until there is enough.
 */
export function mapCoverage(sessions: readonly Pick<LiveAgentSession, 'mappedHits' | 'unmappedHits'>[]): { percent: number; total: number } | null {
  let mapped = 0;
  let total = 0;
  for (const s of sessions) {
    mapped += s.mappedHits;
    total += s.mappedHits + s.unmappedHits;
  }
  return total >= MIN_COVERAGE_SAMPLE ? { percent: Math.round((mapped / total) * 100), total } : null;
}

/** A "your turn" flag older than this no longer asks for attention. */
export const DONE_ATTENTION_MS = 10 * 60 * 1000;

export interface AttentionItem {
  session: LiveAgentSession;
  reason: 'waiting' | 'done';
  since: number;
}

/**
 * Sessions that need the user, most urgent first: permission requests (the
 * agent is blocked) before finished turns, each longest-waiting first.
 */
export function attentionQueue(sessions: readonly LiveAgentSession[], now: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const session of sessions) {
    if (session.status === 'ended' || session.lastActionAt == null) continue;
    if (session.lastAction === 'waiting') items.push({ session, reason: 'waiting', since: session.lastActionAt });
    else if (session.lastAction === 'done' && now - session.lastActionAt < DONE_ATTENTION_MS) {
      items.push({ session, reason: 'done', since: session.lastActionAt });
    }
  }
  return items.sort((a, b) => Number(a.reason === 'done') - Number(b.reason === 'done') || a.since - b.since);
}

export interface ProjectLiveSnapshot {
  canvasId: string;
  /** Server-side canvas name (agents can name an auto-named canvas). */
  canvasName: string;
  isProject: boolean;
  agenticProjectId: string | null;
  /** Workspace an agent pairing is approved into. */
  workspaceId: string | null;
  repositoryRemote: string | null;
  canvasUpdatedAt: number;
  serverTime: number;
  /** Active agent links (one per `link`d checkout); sessions there need no pairing. */
  linkedCheckouts: number;
  /** Read-only watch link path (`/live/<token>`); null when sharing is unavailable. */
  watchPath: string | null;
  /** When the detailed map was last drawn; null until there is one. */
  detailUpdatedAt: number | null;
  /** The detailed map, sent only when asked for and newer than the client's copy. */
  detail?: DetailMapGraph;
  sessions: LiveAgentSession[];
}

/** Detailed map of a project: overview components as boxes of their parts. */
export interface DetailMapGraph {
  nodes: import('reactflow').Node[];
  edges: import('reactflow').Edge[];
  updatedAt: number;
}

export type MapLevel = 'overview' | 'detail';

/**
 * Sessions as the detailed map places them: on the part they are working in
 * when known, else on their component (whose box has the same id).
 */
export function sessionsForLevel<T extends Pick<LiveAgentSession, 'currentComponentId' | 'detailComponentId'>>(
  sessions: readonly T[],
  level: MapLevel,
): T[] {
  if (level !== 'detail') return sessions as T[];
  return sessions.map((s) => (s.detailComponentId ? { ...s, currentComponentId: s.detailComponentId } : s));
}

export interface NodeSessionMark {
  sessionKey: string;
  /** Short session name ("Otter"); absent in older snapshots. */
  name?: string;
  label: string;
  color: string;
  status: AgentSessionStatus;
  /** The session's most recent edit landed on this node. */
  isCurrent: boolean;
}

export interface NodeLiveActivity {
  sessions: NodeSessionMark[];
  /** Edited by an active session within RECENT_EDIT_MS. */
  recent: boolean;
  /** Two or more working sessions edited it within IDLE_AFTER_MS: they may be stepping on each other. */
  contested?: boolean;
  /** Session that added this component to the diagram within RECENT_CHANGE_MS. */
  addedBy?: { sessionKey: string; label: string; color: string };
}

/** Components that two or more working sessions edited within the last couple of minutes, with those sessions. */
export function collisions(sessions: readonly LiveAgentSession[], now: number): Map<string, LiveAgentSession[]> {
  const byNode = new Map<string, LiveAgentSession[]>();
  for (const session of sessions) {
    if (session.status !== 'active') continue;
    for (const [nodeId, entry] of Object.entries(session.touched)) {
      if (now - entry.lastAt >= IDLE_AFTER_MS) continue;
      byNode.set(nodeId, [...(byNode.get(nodeId) ?? []), session]);
    }
  }
  for (const [nodeId, list] of byNode) if (list.length < 2) byNode.delete(nodeId);
  return byNode;
}

/**
 * Per-node overlay data from the live snapshot. Ended sessions are dropped;
 * marks are ordered active-first, then by most recent touch.
 */
export function buildNodeActivity(sessions: readonly LiveAgentSession[], now: number): Record<string, NodeLiveActivity> {
  const byNode: Record<string, Array<NodeSessionMark & { lastAt: number }>> = {};
  const recent = new Set<string>();

  for (const session of sessions) {
    if (session.status === 'ended') continue;
    for (const [nodeId, entry] of Object.entries(session.touched)) {
      (byNode[nodeId] ??= []).push({
        sessionKey: session.sessionKey,
        name: session.name,
        label: session.label,
        color: session.color,
        status: session.status,
        isCurrent: session.currentComponentId === nodeId,
        lastAt: entry.lastAt,
      });
      if (session.status === 'active' && now - entry.lastAt < RECENT_EDIT_MS) recent.add(nodeId);
    }
  }

  const result: Record<string, NodeLiveActivity> = {};
  for (const [nodeId, marks] of Object.entries(byNode)) {
    marks.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.lastAt - a.lastAt);
    const editing = marks.filter((m) => m.status === 'active' && now - m.lastAt < IDLE_AFTER_MS).length;
    result[nodeId] = {
      sessions: marks.map(({ lastAt: _lastAt, ...mark }) => mark),
      recent: recent.has(nodeId),
      ...(editing >= 2 ? { contested: true } : {}),
    };
  }

  // Newest change wins when several sessions added the same id.
  const changes = sessions
    .filter((s) => s.lastChange && now - s.lastChange.at < RECENT_CHANGE_MS)
    .sort((a, b) => a.lastChange!.at - b.lastChange!.at);
  for (const session of changes) {
    for (const { id } of session.lastChange!.added) {
      result[id] ??= { sessions: [], recent: false };
      result[id].addedBy = { sessionKey: session.sessionKey, label: session.label, color: session.color };
    }
  }
  return result;
}

function sameActivity(a: NodeLiveActivity, b: NodeLiveActivity): boolean {
  if (a.recent !== b.recent || Boolean(a.contested) !== Boolean(b.contested) || a.sessions.length !== b.sessions.length) return false;
  if (a.addedBy?.sessionKey !== b.addedBy?.sessionKey || a.addedBy?.label !== b.addedBy?.label || a.addedBy?.color !== b.addedBy?.color) return false;
  return a.sessions.every((m, i) => {
    const n = b.sessions[i];
    return m.sessionKey === n.sessionKey && m.name === n.name && m.label === n.label && m.color === n.color && m.status === n.status && m.isCurrent === n.isCurrent;
  });
}

/**
 * Keeps the previous entry for every node whose activity did not change (and
 * the previous map when nothing changed), so nodes subscribed to their own
 * entry do not re-render on every poll.
 */
export function reuseNodeActivity(
  prev: Record<string, NodeLiveActivity>,
  next: Record<string, NodeLiveActivity>,
): Record<string, NodeLiveActivity> {
  let unchanged = Object.keys(prev).length === Object.keys(next).length;
  const result: Record<string, NodeLiveActivity> = {};
  for (const [nodeId, entry] of Object.entries(next)) {
    const old = prev[nodeId];
    if (old && sameActivity(old, entry)) {
      result[nodeId] = old;
    } else {
      result[nodeId] = entry;
      unchanged = false;
    }
  }
  return unchanged ? prev : result;
}

export const LIVE_POLL_ACTIVE_MS = 2_000;
export const LIVE_POLL_QUIET_MS = 5_000;

/** Poll fast while a session is working, slower while every session is idle or none exists. */
export function livePollBaseMs(sessions: readonly { status: AgentSessionStatus }[]): number {
  return sessions.some((s) => s.status === 'active') ? LIVE_POLL_ACTIVE_MS : LIVE_POLL_QUIET_MS;
}
