import { create } from 'zustand';
import { fetchProjectLive } from '@/lib/client/api-client';
import { buildNodeActivity, type DetailMapGraph, type MapLevel, type NodeLiveActivity, type ProjectLiveSnapshot } from '@/lib/diagram/projects/liveActivity';
import { hasPendingCanvasSave } from '@/store/diagram/persistence/dbSave';
import { useDiagramStore } from '@/store/diagramStore';
import { isAutoCanvasName } from '@/lib/diagram/canvas/canvasNames';

/**
 * Live coding-agent activity for the active project canvas. Deliberately
 * separate from diagramStore: overlay updates must never touch nodes, undo
 * history or auto-save.
 */

const VISIBLE_POLL_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

interface ProjectLiveState {
  canvasId: string | null;
  snapshot: ProjectLiveSnapshot | null;
  nodeActivity: Record<string, NodeLiveActivity>;
  /** Session the user picked in the panel; its components are highlighted. */
  focusedSessionKey: string | null;
  error: string | null;
  /** Which map the canvas shows: the overview (the editable canvas) or the detailed map (view only). */
  level: MapLevel;
  /** Detailed map, fetched while it is shown. */
  detail: DetailMapGraph | null;
  setLevel: (level: MapLevel) => void;
  start: (canvasId: string) => void;
  stop: () => void;
  refresh: () => Promise<void>;
  setFocusedSession: (sessionKey: string | null) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
let failures = 0;

function isVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function schedule(run: () => void) {
  clearTimeout(timer);
  if (!isVisible()) return; // resumed by the visibilitychange listener
  const delay = Math.min(VISIBLE_POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
  timer = setTimeout(run, delay);
}

let reloading: Promise<void> | null = null;

/** Adopt a name the server gave an auto-named canvas (the linked repository). */
function maybeAdoptCanvasName(snapshot: ProjectLiveSnapshot) {
  const diagram = useDiagramStore.getState();
  const tab = diagram.canvases.find((c) => c.id === snapshot.canvasId);
  if (!tab || !snapshot.canvasName || tab.name === snapshot.canvasName) return;
  // Never override a name the user typed.
  if (!isAutoCanvasName(tab.name) || isAutoCanvasName(snapshot.canvasName)) return;
  diagram.renameCanvas(tab.id, snapshot.canvasName);
}

/** Pull in agent-published diagram changes unless the user has unsaved edits. */
function maybeReloadCanvas(snapshot: ProjectLiveSnapshot) {
  // A slow reload can outlast the poll interval: never run two at once.
  if (reloading) return;
  const diagram = useDiagramStore.getState();
  const tab = diagram.canvases.find((c) => c.id === snapshot.canvasId);
  if (!tab || tab.serverUpdatedAt === undefined) return;
  if (snapshot.canvasUpdatedAt <= tab.serverUpdatedAt) return;
  if (hasPendingCanvasSave(snapshot.canvasId)) return;
  reloading = diagram.reloadCanvasFromDB(snapshot.canvasId, { skipIfDirty: true }).finally(() => { reloading = null; });
}

export const useProjectLiveStore = create<ProjectLiveState>()((set, get) => ({
  canvasId: null,
  snapshot: null,
  nodeActivity: {},
  focusedSessionKey: null,
  error: null,
  level: 'overview',
  detail: null,

  // A view preference (never on the diagram undo stack); fetches the map at once.
  setLevel: (level) => {
    if (get().level === level) return;
    set({ level });
    if (level === 'detail') void get().refresh();
  },

  start: (canvasId) => {
    if (get().canvasId === canvasId) return;
    get().stop();
    failures = 0;
    // Every project opens on its overview.
    set({ canvasId, snapshot: null, nodeActivity: {}, focusedSessionKey: null, error: null, level: 'overview', detail: null });
    void get().refresh();
  },

  stop: () => {
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
    set({ canvasId: null, snapshot: null, nodeActivity: {}, focusedSessionKey: null, error: null, level: 'overview', detail: null });
  },

  refresh: async () => {
    const canvasId = get().canvasId;
    if (!canvasId) return;
    clearTimeout(timer);
    controller?.abort();
    const current = new AbortController();
    controller = current;
    try {
      const { level, detail } = get();
      const snapshot = await fetchProjectLive(canvasId, current.signal, level === 'detail' ? detail?.updatedAt ?? 0 : undefined);
      if (get().canvasId !== canvasId) return;
      failures = 0;
      set({
        snapshot,
        nodeActivity: buildNodeActivity(snapshot.sessions, snapshot.serverTime),
        error: null,
        ...(snapshot.detail ? { detail: snapshot.detail } : snapshot.detailUpdatedAt === null ? { detail: null } : {}),
      });
      maybeAdoptCanvasName(snapshot);
      maybeReloadCanvas(snapshot);
    } catch (err) {
      if (current.signal.aborted || get().canvasId !== canvasId) return;
      failures = Math.min(failures + 1, 4);
      set({ error: err instanceof Error ? err.message : 'Live updates unavailable' });
    }
    if (get().canvasId === canvasId) schedule(() => void get().refresh());
  },

  setFocusedSession: (sessionKey) => set({ focusedSessionKey: sessionKey }),
}));

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const { canvasId, refresh } = useProjectLiveStore.getState();
    if (canvasId && isVisible()) void refresh();
  });
}

const EMPTY: NodeLiveActivity | undefined = undefined;

/** Overlay data for one node (undefined when no session touched it). */
export function useNodeLiveActivity(nodeId: string): NodeLiveActivity | undefined {
  return useProjectLiveStore((s) => s.nodeActivity[nodeId] ?? EMPTY);
}
