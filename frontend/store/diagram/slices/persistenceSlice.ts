import type { StateCreator } from 'zustand';
import type { Edge, Node } from 'reactflow';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/lib/config';
import { fetchUserCanvases as apiGetUserCanvases } from '@/lib/api-client';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import type { DiagramState, CanvasTab } from '../types';
import { MAX_GUEST_CANVASES } from '../constants';
import { mergeCanvases } from '../helpers/canvasHelpers';
import { normalizeNodes } from '../helpers/nodeHelpers';
import { normalizeEdges } from '../helpers/edgeHelpers';
import { debouncedSaveCanvasToDB } from '../persistence/dbSave';

export type PersistenceSlice = Pick<
  DiagramState,
  | 'userProfile'
  | 'setUserProfile'
  | 'savingState'
  | 'setSavingState'
  | 'loadCanvasesFromDB'
  | 'saveCanvasToDB'
>;

export const createPersistenceSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  PersistenceSlice
> = (set, get) => ({
  userProfile: null,

  setUserProfile: (profile) => {
    const isGuest = !profile || profile.id === 'guest';
    if (isGuest) {
      let guestCanvas;
      const guestSaved = typeof window !== 'undefined' ? localStorage.getItem('archdraw-guest-canvas') : null;
      if (guestSaved) {
        try {
          guestCanvas = JSON.parse(guestSaved);
        } catch {
          guestCanvas = {
            id: 'guest-canvas',
            name: 'Elephant',
            nodes: [],
            edges: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isOpen: true,
            lastAccessedAt: Date.now(),
          };
        }
      } else {
        guestCanvas = {
          id: 'guest-canvas',
          name: 'Elephant',
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isOpen: true,
          lastAccessedAt: Date.now(),
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('archdraw-guest-canvas', JSON.stringify(guestCanvas));
        }
      }
      const targetId = guestCanvas.id || 'guest-canvas';
      set({
        userProfile: profile,
        canvases: [guestCanvas],
        activeCanvasId: targetId,
        openCanvasIds: [targetId],
      });
    } else {
      set({ userProfile: profile });
    }
  },

  savingState: 'idle',
  setSavingState: (s) => set({ savingState: s }),

  loadCanvasesFromDB: async () => {
    if (!process.env.DATABASE_URL) return;
    const { activeCanvasId, canvases: localCanvases } = get();
    try {
      const { useAuthStore } = await import('@/store/authStore');
      const { user } = useAuthStore.getState();
      if (!user || user.id === 'guest') return;

      const rows = await apiGetUserCanvases();
      if (rows && rows.length > 0) {
        const dbCanvases: CanvasTab[] = rows.map(
          (d: { id: string; name: string; nodes: unknown; edges: unknown; updatedAt: Date | null }) => {
            const rawNodes = normalizeNodes((d.nodes as unknown as Node[]) ?? []);
            const sortedNodes = validateAndFixNodes(rawNodes);
            return {
              id: d.id,
              name: d.name,
              nodes: sortedNodes,
              edges: normalizeEdges((d.edges as unknown as Edge[]) ?? []),
              updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
              isOpen: true,
              lastAccessedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
            };
          }
        );

        const mergedCanvases = mergeCanvases(localCanvases, dbCanvases);

        const openIds = mergedCanvases.map((c) => c.id);
        const targetCanvas = mergedCanvases.find((c) => c.id === activeCanvasId) || mergedCanvases[0];
        set({
          canvases: mergedCanvases,
          openCanvasIds: openIds,
          activeCanvasId: targetCanvas.id,
        });
      }
    } catch {
      // silently fail — guest fallback
    }
  },

  saveCanvasToDB: (canvasId) => {
    const state = get();
    const isGuest = !state.userProfile || state.userProfile.id === 'guest';
    if (isGuest) {
      try {
        const guestCanvases = state.canvases.slice(0, MAX_GUEST_CANVASES);
        const serializedAll = JSON.stringify(guestCanvases);
        if (serializedAll.length > 2 * 1024 * 1024) {
          toast.warning(
            'Your guest canvases are approaching the 2MB size limit. Please sign in to save without limits.'
          );
        }
        localStorage.setItem(STORAGE_KEYS.guestCanvases, serializedAll);

        const active = state.canvases.find((c) => c.id === canvasId) || guestCanvases[0];
        if (active) {
          localStorage.setItem('archdraw-guest-canvas', JSON.stringify(active));
        }
      } catch {
        // ignore
      }
      return;
    }
    debouncedSaveCanvasToDB(canvasId, get);
  },
});
