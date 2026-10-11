import { saveUserCanvas as apiSaveUserCanvas, deleteUserCanvasApi as apiDeleteUserCanvas } from '@/lib/client/api-client';
import type { DiagramState } from '../types';
import logger from '@/lib/logger';
import { toast } from 'sonner';

const SAVE_DEBOUNCE_MS = 1500;

type SaveOptions = {
  /** Skip the conflict check and overwrite the server copy ("keep mine"). */
  force?: boolean;
  /** Use a keepalive request so the save survives page unload. */
  keepalive?: boolean;
};

/** Persist one canvas tab to the API (authenticated users only). */
async function saveCanvasToDBNow(canvasId: string, get: () => DiagramState, options: SaveOptions = {}): Promise<void> {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
  if (!authEnabled) return;
  const state = get();
  if (!state.userProfile || state.userProfile.id === 'guest') return;
  const canvas = state.canvases.find((c) => c.id === canvasId);
  if (!canvas) return;
  // Pre-flight: warn if payload is approaching Next.js 1MB body limit
  try {
    const payloadSize = JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }).length;
    if (payloadSize > 900_000) {
      logger.warn('[CanvasPersistence] Canvas payload large:', { canvasId, payloadSize });
      // Still attempt save, server will return 413 if too large
    }
  } catch (jsonErr) {
    logger.error('[CanvasPersistence] Failed to serialize canvas:', jsonErr);
    state.setSavingState('idle');
    toast.error('Failed to save — canvas contains invalid data');
    return;
  }
  state.setSavingState('saving');
  try {
    const saved = await apiSaveUserCanvas({
      id: canvasId,
      name: canvas.name,
      nodes: canvas.nodes as object,
      edges: canvas.edges as object,
      ...(options.force || canvas.serverUpdatedAt === undefined ? {} : { baseUpdatedAt: canvas.serverUpdatedAt }),
    }, { keepalive: options.keepalive }) as { updatedAt?: string } | null;
    const serverUpdatedAt = saved?.updatedAt ? new Date(saved.updatedAt).getTime() : NaN;
    if (Number.isFinite(serverUpdatedAt)) get().setCanvasServerVersion(canvasId, serverUpdatedAt);
    state.setSavingState('saved');
    setTimeout(() => {
      if (get().savingState === 'saved') get().setSavingState('idle');
    }, 2000);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string; details?: unknown };
    const isQuotaError = e?.code === 'CANVAS_SIZE_EXCEEDED' || e?.code === 'CANVAS_LIMIT_EXCEEDED';
    const logFn = isQuotaError ? logger.warn : logger.error;
    // Log both structured context and raw error — previous version logged {} when e was empty
    logFn('[CanvasPersistence] Failed to save canvas to database:', {
      canvasId,
      name: canvas.name,
      nodeCount: canvas.nodes?.length ?? 0,
      edgeCount: canvas.edges?.length ?? 0,
      status: e?.status,
      code: e?.code,
      message: e?.message || String(err),
      details: e?.details,
      raw: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    // Also log raw error itself so console never shows just {}
    if (!(err instanceof Error) || !e?.message) {
      logFn('[CanvasPersistence] Raw error object:', err);
    }
    state.setSavingState('idle');
    // Surface actionable message instead of generic "Failed to save canvas" console error
    if (e.code === 'CANVAS_CONFLICT') {
      toast.error(`"${canvas.name}" was changed in another tab or device.`, {
        id: `canvas-conflict-${canvasId}`,
        duration: Infinity,
        action: {
          label: 'Keep mine',
          onClick: () => { void enqueueSave(canvasId, get, { force: true }); },
        },
        cancel: {
          label: 'Load theirs',
          onClick: () => { void get().reloadCanvasFromDB(canvasId); },
        },
      });
      return;
    }
    if (e.status === 401) {
      toast.error('Session expired — please sign in again to sync');
      return;
    }
    if (e.code === 'CANVAS_SIZE_EXCEEDED') {
      toast.error(e.message);
      return;
    }
    if (e.code === 'CANVAS_LIMIT_EXCEEDED') {
      toast.error(e.message);
      return;
    }
    if (e.status === 413) {
      toast.error('Canvas too large to save — try splitting into smaller diagrams');
      return;
    }
    if (e.status === 403) {
      toast.error('You do not have permission to save this canvas');
      return;
    }
    toast.error(e.message || 'Failed to sync canvas to cloud');
  }
}

// Per-canvas debounce timers. A single shared debounce meant editing canvas A
// and then touching canvas B within the window silently dropped A's save.
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Saves for the same canvas run one at a time so each carries the server
// version returned by the previous one (otherwise they'd 409 each other).
const inflightSaves = new Map<string, Promise<void>>();
let latestGet: (() => DiagramState) | null = null;

function enqueueSave(canvasId: string, get: () => DiagramState, options?: SaveOptions): Promise<void> {
  const previous = inflightSaves.get(canvasId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => saveCanvasToDBNow(canvasId, get, options));
  inflightSaves.set(canvasId, next);
  void next.finally(() => {
    if (inflightSaves.get(canvasId) === next) inflightSaves.delete(canvasId);
  });
  return next;
}

/** Debounced persist of a single canvas tab, debounced independently per canvas. */
export function debouncedSaveCanvasToDB(canvasId: string, get: () => DiagramState): void {
  latestGet = get;
  clearTimeout(pendingTimers.get(canvasId));
  pendingTimers.set(canvasId, setTimeout(() => {
    pendingTimers.delete(canvasId);
    void enqueueSave(canvasId, get);
  }, SAVE_DEBOUNCE_MS));
}

/** True while a save for this canvas is debounced or in flight. */
export function hasPendingCanvasSave(canvasId: string): boolean {
  return pendingTimers.has(canvasId) || inflightSaves.has(canvasId);
}

export async function flushCanvasSaveToDB(canvasId: string, get: () => DiagramState): Promise<void> {
  clearTimeout(pendingTimers.get(canvasId));
  pendingTimers.delete(canvasId);
  await enqueueSave(canvasId, get);
}

/** Immediately send every debounced-but-unsent save (e.g. on page hide). */
export function flushAllPendingCanvasSaves(options: { keepalive?: boolean } = {}): Promise<void[]> {
  const get = latestGet;
  const ids = Array.from(pendingTimers.keys());
  for (const id of ids) clearTimeout(pendingTimers.get(id));
  pendingTimers.clear();
  if (!get) return Promise.resolve([]);
  return Promise.all(ids.map((id) => enqueueSave(id, get, { keepalive: options.keepalive })));
}

if (typeof window !== 'undefined') {
  // Without this, edits made in the last debounce window before closing the
  // tab never reached the server for signed-in users.
  window.addEventListener('pagehide', () => { void flushAllPendingCanvasSaves({ keepalive: true }); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAllPendingCanvasSaves({ keepalive: true });
  });
}

export async function deleteCanvasFromDB(canvasId: string, get: () => DiagramState): Promise<void> {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
  if (!authEnabled) return;
  const state = get();
  if (!state.userProfile || state.userProfile.id === 'guest') return;
  try {
    await apiDeleteUserCanvas(canvasId);
  } catch (err) {
    logger.error('[CanvasPersistence] Failed to delete canvas from database:', err);
  }
}
