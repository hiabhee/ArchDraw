import { STORAGE_KEYS } from '@/lib/config';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import { resolveNodeCollisions } from '@/src/utils/resolveNodeCollisions';
import { ensureSubgraphBoundsContainChildren } from '@/lib/mermaid/recomputeSubgraphBounds';
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

function normalizeAllCanvases(
  canvases: CanvasTab[],
  renderStyleId: string,
  iconMode: DiagramState['iconMode'],
): CanvasTab[] {
  return canvases.map((c) => {
    const normalizedNodes = normalizeNodes(c.nodes || []);
    const cleaned = stripReservedLayerNodes(normalizedNodes);
    const validated = validateAndFixNodes(cleaned);
    const resolved = resolveNodeCollisions(sanitizeNodes(validated));
    const normalizedEdges = applyBidirectionalEdgeFixes(
      sanitizeEdges(normalizeEdges(c.edges || [])),
      resolved,
    );

    // Auto-straighten: Dagre / manual nudge can leave 1-12px deltas that show
    // as a diagonal slit and only snap to 0° after a click/drag. Fix on
    // rehydrate so the first render is already straight.
    {
      const STRAIGHT_THRESHOLD = 12;
      const isVerticalLayout = false; // rehydrate has no stored direction — LR is default
      const nodeById = new Map(resolved.map((n) => [n.id, n as unknown as { id: string; position: { x: number; y: number }; width?: number; height?: number; data?: { nodeWidth?: number; nodeHeight?: number }; parentId?: string; parentNode?: string }]));
      const getWH = (n: { width?: number; height?: number; data?: { nodeWidth?: number; nodeHeight?: number } }) => {
        const w = n.width ?? n.data?.nodeWidth ?? 200;
        const h = n.height ?? n.data?.nodeHeight ?? 100;
        return { w, h };
      };
      const edgesByDelta = [...normalizedEdges]
        .map((e) => {
          const src = nodeById.get(e.source);
          const tgt = nodeById.get(e.target);
          if (!src || !tgt) return null;
          const srcParent = (src as { parentId?: string; parentNode?: string }).parentId ?? (src as { parentId?: string; parentNode?: string }).parentNode;
          const tgtParent = (tgt as { parentId?: string; parentNode?: string }).parentId ?? (tgt as { parentId?: string; parentNode?: string }).parentNode;
          if (srcParent !== tgtParent) return null;
          const { w: sw, h: sh } = getWH(src);
          const { w: tw, h: th } = getWH(tgt);
          const srcCX = src.position.x + sw / 2;
          const srcCY = src.position.y + sh / 2;
          const tgtCX = tgt.position.x + tw / 2;
          const tgtCY = tgt.position.y + th / 2;
          const dx = tgtCX - srcCX;
          const dy = tgtCY - srcCY;
          const d = isVerticalLayout ? Math.abs(dx) : Math.abs(dy);
          return { e, d, dx, dy, src, tgt };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null && x.d < STRAIGHT_THRESHOLD && x.d > 0.01)
        .sort((a, b) => a.d - b.d);
      const moved = new Set<string>();
      for (const { dx, dy, src, tgt } of edgesByDelta) {
        const isHorizontalEdge = Math.abs(dx) > Math.abs(dy);
        if (!isVerticalLayout && !isHorizontalEdge) continue;
        if (isVerticalLayout && isHorizontalEdge) continue;
        if (moved.has(tgt.id)) continue;
        const { w: sw, h: sh } = getWH(src);
        const { w: tw, h: th } = getWH(tgt);
        if (!isVerticalLayout) {
          const desiredTgtY = src.position.y + sh / 2 - th / 2;
          if (Math.abs(desiredTgtY - tgt.position.y) < STRAIGHT_THRESHOLD) {
            tgt.position = { ...tgt.position, y: desiredTgtY };
            moved.add(tgt.id);
          }
        } else {
          const desiredTgtX = src.position.x + sw / 2 - tw / 2;
          if (Math.abs(desiredTgtX - tgt.position.x) < STRAIGHT_THRESHOLD) {
            tgt.position = { ...tgt.position, x: desiredTgtX };
            moved.add(tgt.id);
          }
        }
      }
    }

    const containedNodes = ensureSubgraphBoundsContainChildren(resolved, renderStyleId, iconMode);

    return {
      ...c,
      nodes: containedNodes,
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

function hasCanvasContent(canvases: CanvasTab[] | undefined): boolean {
  return Boolean(
    canvases?.some((c) => (c.nodes?.length ?? 0) > 0 || (c.edges?.length ?? 0) > 0),
  );
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
    // Fresh guest tab — but keep persisted diagrams (e.g. after session expiry).
    if (hasCanvasContent(state.canvases)) {
      markGuestSessionActive();
    } else {
      rehydrateGuestNewSession(state);
    }
  } else if (isGuest) {
    loadGuestCanvasesFromLocalStorage(state);
    markGuestSessionActive();
  }

  if (state.canvases && state.canvases.length > 0) {
    if (!state.activeCanvasId || !state.canvases.find((c) => c.id === state.activeCanvasId)) {
      state.activeCanvasId = state.canvases[0].id;
    }
    state.canvases = normalizeAllCanvases(
      state.canvases,
      state.diagramRenderStyle,
      state.iconMode,
    );
  }

  if (!state.canvasBackground) {
    state.canvasBackground = { variant: 'lines', bgColor: null, patternColor: null, gap: 24, size: 1 };
  } else if (state.canvasBackground.variant !== 'dots' && state.canvasBackground.variant !== 'lines') {
    state.canvasBackground = { ...state.canvasBackground, variant: 'lines' };
  }
}

/** Zustand persist `onRehydrateStorage` inner callback factory. */
export function onDiagramRehydrate() {
  return (state: DiagramState | undefined) => {
    if (state) rehydrateDiagramState(state);
  };
}
