import type { StateCreator } from 'zustand';
import type { Edge, Node } from 'reactflow';
import { toast } from 'sonner';
import { fetchUserCanvases as apiGetUserCanvases } from '@/lib/client/api-client';
import { validateAndFixNodes } from '@/lib/diagram/nodes/nodeValidation';
import type { DiagramState, CanvasTab, SetUserProfileOptions } from '../types';
import { MAX_GUEST_CANVASES } from '../constants';
import { mergeCanvases } from '../helpers/canvasHelpers';
import { normalizeNodes } from '../helpers/nodeHelpers';
import { normalizeEdges } from '../helpers/edgeHelpers';
import { debouncedSaveCanvasToDB } from '../persistence/dbSave';
import { withAutoSaveSuppressed } from '../persistence/autoSave';

type CanvasRow = {
  id: string;
  name: string;
  nodes: unknown;
  edges: unknown;
  updatedAt: Date | string | null;
  agenticProjectId?: string | null;
};

function canvasFromRow(d: CanvasRow): CanvasTab {
  const rawNodes = normalizeNodes((d.nodes as unknown as Node[]) ?? []);
  const updatedAt = d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now();
  return {
    id: d.id,
    name: d.name,
    nodes: validateAndFixNodes(rawNodes),
    edges: normalizeEdges((d.edges as unknown as Edge[]) ?? []),
    updatedAt,
    serverUpdatedAt: d.updatedAt ? updatedAt : undefined,
    isOpen: true,
    lastAccessedAt: updatedAt,
    agenticProjectId: d.agenticProjectId ?? null,
  };
}

const GUEST_STORAGE_WARN_BYTES = 2 * 1024 * 1024;
let guestSizeCheckTimer: ReturnType<typeof setTimeout> | undefined;

function warnIfGuestStorageLarge(get: () => DiagramState) {
  clearTimeout(guestSizeCheckTimer);
  guestSizeCheckTimer = setTimeout(() => {
    try {
      const size = JSON.stringify(get().canvases.slice(0, MAX_GUEST_CANVASES)).length;
      if (size > GUEST_STORAGE_WARN_BYTES) {
        toast.warning('Your guest canvases are approaching the 2MB size limit. Please sign in to save without limits.');
      }
    } catch {
      // ignore
    }
  }, 1500);
}

function hasCanvasContent(canvases: CanvasTab[]): boolean {
  return canvases.some((c) => (c.nodes?.length ?? 0) > 0 || (c.edges?.length ?? 0) > 0);
}

export type PersistenceSlice = Pick<
  DiagramState,
  | 'userProfile'
  | 'setUserProfile'
  | 'savingState'
  | 'setSavingState'
  | 'setCanvasServerVersion'
  | 'setCanvasProjectLink'
  | 'reloadCanvasFromDB'
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

  setUserProfile: (profile, options?: SetUserProfileOptions) => {
    const isGuest = !profile || profile.id === 'guest';
    if (isGuest && options?.preserveCanvases) {
      set({ userProfile: profile });
      return;
    }
    if (isGuest) {
      const existing = get();
      if (hasCanvasContent(existing.canvases)) {
        set({ userProfile: profile });
        return;
      }
      // Guest canvases persist through zustand `persist` (archdraw-storage)
      // only; the legacy archdraw-guest-canvas / guestCanvases keys are read
      // once during rehydrate for migration and no longer written.
      const guestCanvas: CanvasTab = {
        id: 'guest-canvas',
        name: 'Elephant',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isOpen: true,
        lastAccessedAt: Date.now(),
      };
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

  setCanvasServerVersion: (canvasId, serverUpdatedAt) => {
    set({
      canvases: get().canvases.map((c) => (c.id === canvasId ? { ...c, serverUpdatedAt } : c)),
    });
  },

  setCanvasProjectLink: (canvasId, agenticProjectId) => {
    set({
      canvases: get().canvases.map((c) => (c.id === canvasId ? { ...c, agenticProjectId } : c)),
    });
  },

  reloadCanvasFromDB: async (canvasId) => {
    try {
      const rows = (await apiGetUserCanvases()) as CanvasRow[];
      const row = rows?.find((r) => r.id === canvasId);
      if (!row) return;
      const fresh = canvasFromRow(row);
      withAutoSaveSuppressed(() => set({
        canvases: get().canvases.map((c) =>
          c.id === canvasId ? { ...fresh, isOpen: c.isOpen, isPinned: c.isPinned } : c
        ),
        ...(get().activeCanvasId === canvasId ? { past: [], future: [] } : {}),
      }));
    } catch {
      toast.error('Could not load the latest version of this canvas');
    }
  },

  loadCanvasesFromDB: async () => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!authEnabled) return;
    const { activeCanvasId, canvases: localCanvases } = get();
    try {
      const { useAuthStore } = await import('@/store/authStore');
      const { user } = useAuthStore.getState();
      if (!user || user.id === 'guest') return;

      const rows = await apiGetUserCanvases();
      if (rows && rows.length > 0) {
        const dbCanvases: CanvasTab[] = (rows as CanvasRow[]).map(canvasFromRow);

        const mergedCanvases = mergeCanvases(localCanvases, dbCanvases);

        const openIds = mergedCanvases.map((c) => c.id);
        const targetCanvas = mergedCanvases.find((c) => c.id === activeCanvasId) || mergedCanvases[0];
        // Server data — don't echo it straight back as saves.
        withAutoSaveSuppressed(() => set({
          canvases: mergedCanvases,
          openCanvasIds: openIds,
          activeCanvasId: targetCanvas.id,
        }));
      }
    } catch {
      // silently fail — guest fallback
    }
  },

  saveCanvasToDB: (canvasId) => {
    const state = get();
    const isGuest = !state.userProfile || state.userProfile.id === 'guest';
    if (isGuest) {
      // Guest canvases are already persisted by zustand `persist`; just warn
      // (debounced) when they approach the localStorage budget.
      warnIfGuestStorageLarge(get);
      return;
    }
    debouncedSaveCanvasToDB(canvasId, get);
  },
});
