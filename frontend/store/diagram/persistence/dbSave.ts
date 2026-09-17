import { saveUserCanvas as apiSaveUserCanvas, deleteUserCanvasApi as apiDeleteUserCanvas } from '@/lib/api-client';
import { debounce } from '../helpers/debounce';
import type { DiagramState } from '../types';
import logger from '@/lib/logger';
import { toast } from 'sonner';

/** Debounced persist of a single canvas tab to the API (authenticated users only). */
async function saveCanvasToDBNow(canvasId: string, get: () => DiagramState): Promise<void> {
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
    await apiSaveUserCanvas({
      id: canvasId,
      name: canvas.name,
      nodes: canvas.nodes as object,
      edges: canvas.edges as object,
    });
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

export async function flushCanvasSaveToDB(canvasId: string, get: () => DiagramState): Promise<void> {
  debouncedSaveCanvasToDB.cancel();
  await saveCanvasToDBNow(canvasId, get);
}

/** Debounced persist of a single canvas tab to the API (authenticated users only). */
export const debouncedSaveCanvasToDB = debounce((canvasId: string, get: () => DiagramState) => {
  void saveCanvasToDBNow(canvasId, get);
}, 1500);

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
