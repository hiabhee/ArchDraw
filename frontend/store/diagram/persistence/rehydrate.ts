import { STORAGE_KEYS } from '@/lib/config';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import { resolveNodeCollisions } from '@/src/utils/resolveNodeCollisions';
import { MAX_GUEST_CANVASES } from '../constants';
import { normalizeNodes, sanitizeNodes, stripReservedLayerNodes } from '../helpers/nodeHelpers';
import { normalizeEdges, sanitizeEdges, applyBidirectionalEdgeFixes } from '../helpers/edgeHelpers';
import type { CanvasTab, DiagramState } from '../types';

function createDefaultGuestCanvas(): CanvasTab {
  return {
    id: 'guest-canvas',
    name: 'Elephant',
    nodes: [],
    edges: [],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    isOpen: true,
    lastAccessedAt: Date.now(),
  };
}

function normalizeAllCanvases(canvases: CanvasTab[]): CanvasTab[] {
  return canvases.map((c) => {
    const normalizedNodes = normalizeNodes(c.nodes || []);
    const cleaned = stripReservedLayerNodes(normalizedNodes);
    const validated = validateAndFixNodes(cleaned);
    const resolved = resolveNodeCollisions(sanitizeNodes(validated));
    const normalizedEdges = applyBidirectionalEdgeFixes(
      sanitizeEdges(normalizeEdges(c.edges || [])),
      resolved,
    );

    return {
      ...c,
      nodes: resolved,
      edges: normalizedEdges,
    };
  });
}

function rehydrateGuestNewSession(state: DiagramState): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.guestCanvases);
    localStorage.removeItem('archdraw-guest-canvas');
  } catch {
    // ignore
  }

  const defaultGuest = createDefaultGuestCanvas();
  state.canvases = [defaultGuest];
  state.activeCanvasId = 'guest-canvas';
  state.openCanvasIds = ['guest-canvas'];

  try {
    sessionStorage.setItem('archdraw-session-active', 'true');
  } catch {
    // ignore
  }
}

function loadGuestCanvasesFromLocalStorage(state: DiagramState): void {
  if (state.canvases && state.canvases.length > 0) return;

  const guestListSaved = localStorage.getItem(STORAGE_KEYS.guestCanvases);
  if (guestListSaved) {
    try {
      const list = JSON.parse(guestListSaved);
      if (Array.isArray(list) && list.length > 0) {
        const guestCanvases = list
          .filter((c: { id?: string }) => c && typeof c.id === 'string')
          .slice(0, MAX_GUEST_CANVASES)
          .map(
            (c: {
              id: string;
              nodes?: unknown[];
              edges?: unknown[];
              lastAccessedAt?: number;
              updatedAt?: number;
              createdAt?: number;
            }) => ({
              ...c,
              isOpen: true,
              lastAccessedAt: c.lastAccessedAt || c.updatedAt || Date.now(),
              createdAt: c.createdAt || Date.now(),
              updatedAt: c.updatedAt || Date.now(),
              nodes: c.nodes || [],
              edges: c.edges || [],
            })
          );

        state.canvases = guestCanvases as CanvasTab[];
        state.openCanvasIds = guestCanvases.map((c) => c.id);
        state.activeCanvasId =
          state.activeCanvasId && guestCanvases.some((c) => c.id === state.activeCanvasId)
            ? state.activeCanvasId
            : guestCanvases[0].id;

        const active = guestCanvases.find((c) => c.id === state.activeCanvasId) || guestCanvases[0];
        localStorage.setItem('archdraw-guest-canvas', JSON.stringify(active));
      }
    } catch {
      // ignore
    }
  }

  if (!state.canvases || state.canvases.length === 0) {
    const guestSaved = localStorage.getItem('archdraw-guest-canvas');
    if (guestSaved) {
      try {
        const canvas = JSON.parse(guestSaved);
        state.canvases = [{ ...canvas, isOpen: true, lastAccessedAt: Date.now() }];
        state.activeCanvasId = canvas.id || 'guest-canvas';
        state.openCanvasIds = [state.activeCanvasId];
      } catch {
        // ignore
      }
    }
  }

  if (!state.canvases || state.canvases.length === 0) {
    const defaultGuest = createDefaultGuestCanvas();
    state.canvases = [defaultGuest];
    state.activeCanvasId = 'guest-canvas';
    state.openCanvasIds = ['guest-canvas'];
    localStorage.setItem(STORAGE_KEYS.guestCanvases, JSON.stringify([defaultGuest]));
    localStorage.setItem('archdraw-guest-canvas', JSON.stringify(defaultGuest));
  }
}

function markGuestSessionActive(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('archdraw-session-active', 'true');
  } catch {
    // ignore
  }
}

/**
 * Post-rehydration migration: guest session rules + normalize all canvas graphs.
 * Mutates `state` in place (Zustand persist contract).
 */
export function rehydrateDiagramState(state: DiagramState): void {
  const isGuest = !state.userProfile || state.userProfile.id === 'guest';
  const isNewSession =
    typeof window !== 'undefined' && !sessionStorage.getItem('archdraw-session-active');

  if (isGuest && isNewSession) {
    rehydrateGuestNewSession(state);
  } else if (isGuest) {
    loadGuestCanvasesFromLocalStorage(state);
    markGuestSessionActive();
  }

  if (state.canvases && state.canvases.length > 0) {
    if (!state.activeCanvasId || !state.canvases.find((c) => c.id === state.activeCanvasId)) {
      state.activeCanvasId = state.canvases[0].id;
    }
    state.canvases = normalizeAllCanvases(state.canvases);
  }
}

/** Zustand persist `onRehydrateStorage` inner callback factory. */
export function onDiagramRehydrate() {
  return (state: DiagramState | undefined) => {
    if (state) rehydrateDiagramState(state);
  };
}
