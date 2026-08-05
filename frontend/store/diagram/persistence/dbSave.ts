import { saveUserCanvas as apiSaveUserCanvas, deleteUserCanvasApi as apiDeleteUserCanvas } from '@/lib/api-client';
import { debounce } from '../helpers/debounce';
import type { DiagramState } from '../types';

/** Debounced persist of a single canvas tab to the API (authenticated users only). */
export const debouncedSaveCanvasToDB = debounce(async (canvasId: string, get: () => DiagramState) => {
  if (!process.env.DATABASE_URL) return;
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
  } catch {
    state.setSavingState('idle');
  }
}, 1500);

export async function deleteCanvasFromDB(canvasId: string, get: () => DiagramState): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const state = get();
  if (!state.userProfile || state.userProfile.id === 'guest') return;
  try {
    await apiDeleteUserCanvas(canvasId);
  } catch {
    // Silently fail — canvas is already removed from local state
  }
}
