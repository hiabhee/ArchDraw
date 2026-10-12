import type { StructureChange } from './structureDiff';

/**
 * Pure helpers for live agent activity on a project canvas: merging edit
 * events into a session's touched-component map and deriving its status.
 */

export type AgentSessionStatus = 'active' | 'idle' | 'ended';

export type ActivityEvent = 'start' | 'edit' | 'stop' | 'end';

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
export const SESSION_COLORS = [
  '#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#dc2626', '#65a30d', '#c026d3', '#0d9488',
] as const;

export function sessionColor(sessionKey: string): string {
  let hash = 0;
  for (let i = 0; i < sessionKey.length; i++) hash = (hash * 31 + sessionKey.charCodeAt(i)) | 0;
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

/** One session as returned by `GET /api/projects/:canvasId/live`. */
export interface LiveAgentSession {
  id: string;
  sessionKey: string;
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
  sessions: LiveAgentSession[];
}

export interface NodeSessionMark {
  sessionKey: string;
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
  /** Session that added this component to the diagram within RECENT_CHANGE_MS. */
  addedBy?: { sessionKey: string; label: string; color: string };
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
    result[nodeId] = {
      sessions: marks.map(({ lastAt: _lastAt, ...mark }) => mark),
      recent: recent.has(nodeId),
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
