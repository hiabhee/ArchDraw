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
    logger.error('[CanvasPersistence] Failed to save canvas to database:', err);
    state.setSavingState('idle');
    toast.error('Failed to sync canvas to cloud');
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
