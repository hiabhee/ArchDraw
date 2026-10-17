/**
 * Component history: who worked on a component of a live project, when, and
 * why. Stored as work bouts — one session's run of edits on one component —
 * so ten edits in a row read as one entry, not ten.
 */

/** Edits closer together than this extend the session's current bout. */
export const BOUT_GAP_MS = 15 * 60 * 1000;
/** Paths kept per bout (most recent last). */
export const MAX_BOUT_FILES = 12;
/** History outlives sessions (kept 7 days) so a component's past stays readable. */
export const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Entries returned for one component. */
export const HISTORY_LIMIT = 40;

export type ComponentHistoryKind = 'edit' | 'added';

export interface ComponentHistoryEntry {
  id: string;
  componentId: string;
  detailComponentId: string | null;
  sessionKey: string;
  sessionName: string | null;
  kind: ComponentHistoryKind;
  intent: string | null;
  /** Edited paths; empty for watchers (they never see code paths). */
  files: string[];
  fileCount: number;
  edits: number;
  startedAt: number;
  lastAt: number;
}

export interface EditGroup {
  componentId: string;
  detailComponentId: string | null;
  files: string[];
}

/** Split one report's mapped files into one group per component (and detailed-map part). */
export function groupEditsByComponent(
  mapped: Record<string, string>,
  detailOf: (path: string) => string | null = () => null,
): EditGroup[] {
  const groups = new Map<string, EditGroup>();
  for (const [path, componentId] of Object.entries(mapped)) {
    const detailComponentId = detailOf(path);
    const key = `${componentId}\u0000${detailComponentId ?? ''}`;
    const group = groups.get(key) ?? { componentId, detailComponentId, files: [] };
    group.files.push(path);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Add paths to a bout: re-edited paths move to the end, the oldest drop past the cap. */
export function mergeBoutFiles(existing: unknown, added: readonly string[], max = MAX_BOUT_FILES): string[] {
  const files = Array.isArray(existing) ? existing.filter((f): f is string => typeof f === 'string') : [];
  for (const file of added) {
    const at = files.indexOf(file);
    if (at !== -1) files.splice(at, 1);
    files.push(file);
  }
  return files.slice(-max);
}

interface ScopeNode {
  id: string;
  parentNode?: string | null;
  parentId?: string | null;
}

/** A component and everything inside it: an area's history is its components' history. */
export function componentScope(nodes: readonly ScopeNode[], componentId: string): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    const parent = node.parentNode ?? node.parentId;
    if (parent) children.set(parent, [...(children.get(parent) ?? []), node.id]);
  }
  const scope = new Set([componentId]);
  const queue = [componentId];
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (scope.has(child)) continue;
      scope.add(child);
      queue.push(child);
    }
  }
  return [...scope];
}

/** File names for a one-line summary: "auth.ts, session.ts +3". */
export function summarizeFiles(files: readonly string[], fileCount = files.length, shown = 2): string {
  if (fileCount === 0) return '';
  if (files.length === 0) return `${fileCount} file${fileCount === 1 ? '' : 's'}`;
  const names = [...files].reverse().slice(0, shown).map((f) => f.split('/').pop() || f);
  const more = fileCount - names.length;
  return more > 0 ? `${names.join(', ')} +${more}` : names.join(', ');
}
