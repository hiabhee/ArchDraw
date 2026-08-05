import type { StateCreator } from 'zustand';
import { toast } from 'sonner';
import { componentRegistry } from '@/lib/componentRegistry';
import type { DiagramState, CanvasTab } from '../types';
import { MAX_GUEST_CANVASES } from '../constants';
import { invokeFitView } from '../fitView';
import { makeCanvas, INITIAL_CANVAS } from '../helpers/canvasHelpers';
import { deleteCanvasFromDB } from '../persistence/dbSave';

export type CanvasSlice = Pick<
  DiagramState,
  | 'canvases'
  | 'activeCanvasId'
  | 'openCanvasIds'
  | 'nodes'
  | 'edges'
  | 'cloudProvider'
  | 'getRandomAnimalName'
  | 'addCanvas'
  | 'duplicateCanvas'
  | 'removeCanvas'
  | 'switchCanvas'
  | 'renameCanvas'
  | 'openCanvas'
  | 'closeCanvas'
  | 'togglePinCanvas'
  | 'toggleFavorite'
  | 'getOpenCanvases'
  | 'getVisibleCanvases'
  | 'getOverflowCanvases'
  | 'getActiveCanvasId'
  | 'fitView'
>;

export const createCanvasSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  CanvasSlice
> = (set, get) => ({
  canvases: [{ ...INITIAL_CANVAS, isOpen: true, lastAccessedAt: Date.now() }],
  activeCanvasId: INITIAL_CANVAS.id,
  openCanvasIds: [INITIAL_CANVAS.id],
  nodes: [],
  edges: [],
  cloudProvider: 'off',

  getRandomAnimalName: () => {
    const animals = [
      'Elephant', 'Lion', 'Panda', 'Tiger', 'Falcon', 'Shark', 'Wolf', 'Fox', 'Bear', 'Eagle',
      'Owl', 'Hawk', 'Dolphin', 'Penguin', 'Zebra', 'Giraffe', 'Leopard', 'Jaguar', 'Panther', 'Cheetah',
    ];
    const usedNames = get().canvases.map((c) => c.name);
    const available = animals.filter((a) => !usedNames.includes(a));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    const baseAnimal = animals[Math.floor(Math.random() * animals.length)];
    let counter = 1;
    while (usedNames.includes(`${baseAnimal} ${counter}`)) {
      counter++;
    }
    return `${baseAnimal} ${counter}`;
  },

  addCanvas: (customName?: string, canvasId?: string) => {
    const { canvases, openCanvasIds, getRandomAnimalName, userProfile } = get();
    const isGuest = !userProfile || userProfile.id === 'guest';
    if (isGuest) {
      const guestCanvases = canvases.filter((c) => c.id.startsWith('guest-canvas'));
      if (guestCanvases.length >= MAX_GUEST_CANVASES) {
        toast.error(`Guests can have up to ${MAX_GUEST_CANVASES} canvases. Delete one to create a new canvas.`);
        return get().activeCanvasId || 'guest-canvas';
      }

      const id = `guest-${crypto.randomUUID()}`;
      const name = customName || getRandomAnimalName();
      const newCanvas = {
        ...makeCanvas(name, id),
        isOpen: true,
        lastAccessedAt: Date.now(),
      };

      const nextCanvases = [...canvases, newCanvas];
      const nextOpenIds = openCanvasIds.includes(id) ? openCanvasIds : [...openCanvasIds, id];

      set({
        canvases: nextCanvases,
        openCanvasIds: nextOpenIds,
        activeCanvasId: id,
        past: [],
        future: [],
      });

      get().saveCanvasToDB(id);
      return id;
    }

    if (canvasId) {
      const existing = canvases.find((c) => c.id === canvasId);
      if (existing) {
        get().switchCanvas(canvasId);
        return canvasId;
      }
    }

    const baseName = customName || getRandomAnimalName();
    let newName = baseName;
    const existingNames = new Set(canvases.map((c) => c.name));

    let counter = 1;
    while (existingNames.has(newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }

    const newCanvas = makeCanvas(newName, canvasId);
    const canvasWithMeta = { ...newCanvas, isOpen: true, lastAccessedAt: Date.now() };
    const newOpenIds = [...openCanvasIds, newCanvas.id];
    set({
      canvases: [...canvases, canvasWithMeta],
      openCanvasIds: newOpenIds,
      activeCanvasId: newCanvas.id,
      past: [],
      future: [],
    });
    return newCanvas.id;
  },

  duplicateCanvas: (id: string) => {
    const { canvases, openCanvasIds, userProfile } = get();
    const isGuest = !userProfile || userProfile.id === 'guest';
    if (isGuest) {
      toast.error('Sign in to duplicate canvases.');
      return;
    }
    const source = canvases.find((c) => c.id === id);
    if (!source) return;

    const baseName = `${source.name} Copy`;
    let newName = baseName;
    const existingNames = new Set(canvases.map((c) => c.name));

    let counter = 1;
    while (existingNames.has(newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }

    const numbers = canvases
      .map((c) => {
        const match = c.id.match(/^canvas-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newId = `canvas-${max + 1}`;
    const duplicated: CanvasTab = {
      ...source,
      id: newId,
      name: newName,
      isOpen: true,
      lastAccessedAt: Date.now(),
      nodes: JSON.parse(JSON.stringify(source.nodes)),
      edges: JSON.parse(JSON.stringify(source.edges)),
    };

    const newOpenIds = [...openCanvasIds, newId];
    set({
      canvases: [...canvases, duplicated],
      openCanvasIds: newOpenIds,
      activeCanvasId: newId,
      past: [],
      future: [],
    });
    return newId;
  },

  removeCanvas: (id) => {
    const { canvases, activeCanvasId, openCanvasIds, userProfile } = get();
    const isGuest = !userProfile || userProfile.id === 'guest';
    if (isGuest) {
      const guestCanvases = canvases.filter((c) => c.id.startsWith('guest-canvas'));
      if (guestCanvases.length <= 1) {
        const replacementId = guestCanvases[0]?.id || 'guest-canvas';
        const replacement: CanvasTab = {
          id: replacementId,
          name: get().getRandomAnimalName(),
          nodes: [],
          edges: [],
          updatedAt: Date.now(),
          createdAt: Date.now(),
          isOpen: true,
          lastAccessedAt: Date.now(),
        };
        set({
          canvases: [replacement],
          openCanvasIds: [replacementId],
          activeCanvasId: replacementId,
          past: [],
          future: [],
        });
        get().saveCanvasToDB(replacementId);
        return;
      }

      const idx = canvases.findIndex((c) => c.id === id);
      const next = canvases.filter((c) => c.id !== id);
      const newOpenIds = openCanvasIds.filter((cid) => cid !== id);

      let nextActiveId = activeCanvasId;
      if (activeCanvasId === id) {
        const newIdx = Math.max(0, idx - 1);
        nextActiveId = next[newIdx]?.id || next[0]?.id;
      }

      set({
        canvases: next,
        openCanvasIds: newOpenIds,
        activeCanvasId: nextActiveId,
        past: [],
        future: [],
      });
      get().saveCanvasToDB(nextActiveId);
      return;
    }
    if (canvases.length <= 1) return;

    const idx = canvases.findIndex((c) => c.id === id);
    const next = canvases.filter((c) => c.id !== id);
    const newOpenIds = openCanvasIds.filter((cid) => cid !== id);

    let nextActiveId = activeCanvasId;
    if (activeCanvasId === id) {
      const newIdx = Math.max(0, idx - 1);
      nextActiveId = next[newIdx]?.id || next[0]?.id;
    }
    set({
      canvases: next,
      openCanvasIds: newOpenIds,
      activeCanvasId: nextActiveId,
      past: [],
      future: [],
    });

    deleteCanvasFromDB(id, get);
  },

  switchCanvas: async (id) => {
    const { canvases, activeCanvasId, openCanvasIds, userProfile } = get();
    const isGuest = !userProfile || userProfile.id === 'guest';
    if (isGuest && !id.startsWith('guest-canvas')) {
      return;
    }
    if (id === activeCanvasId) return;

    const target = canvases.find((c) => c.id === id);
    if (!target) return;

    await componentRegistry.ensureCustomComponentsForNodes(target.nodes);

    let newOpenIds = openCanvasIds;
    if (!openCanvasIds.includes(id)) {
      newOpenIds = [...openCanvasIds, id];
    }

    const updatedCanvases = canvases.map((c) => {
      if (c.id === id) {
        return { ...c, lastAccessedAt: Date.now() };
      }
      return c;
    });

    set({
      canvases: updatedCanvases,
      openCanvasIds: newOpenIds,
      activeCanvasId: id,
      past: [],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    setTimeout(() => get().fitView(), 80);
  },

  renameCanvas: (id, name) => {
    const canvases = get().canvases.map((c) =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(id);
  },

  openCanvas: async (id) => {
    const { canvases, openCanvasIds } = get();
    const isAlreadyOpen = openCanvasIds.includes(id);

    const target = canvases.find((c) => c.id === id);
    if (!target) return;

    await componentRegistry.ensureCustomComponentsForNodes(target.nodes);

    const newOpenIds = isAlreadyOpen ? openCanvasIds : [...openCanvasIds, id];

    const updatedCanvases = canvases.map((c) => {
      if (c.id === id) {
        return { ...c, isOpen: true, lastAccessedAt: Date.now() };
      }
      return c;
    });

    set({
      canvases: updatedCanvases,
      openCanvasIds: newOpenIds,
      activeCanvasId: id,
      past: [],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    setTimeout(() => get().fitView(), 80);
  },

  closeCanvas: (id) => {
    const { canvases, activeCanvasId, openCanvasIds } = get();

    if (openCanvasIds.length <= 1) return;

    const idx = openCanvasIds.indexOf(id);
    const newOpenIds = openCanvasIds.filter((cid) => cid !== id);

    let nextActiveId = activeCanvasId;
    if (activeCanvasId === id) {
      const newIdx = Math.max(0, idx - 1);
      nextActiveId = newOpenIds[newIdx] || newOpenIds[0];
    }

    const updatedCanvases = canvases.map((c) => {
      if (c.id === id) {
        return { ...c, isOpen: false };
      }
      return c;
    });

    set({
      canvases: updatedCanvases,
      openCanvasIds: newOpenIds,
      activeCanvasId: nextActiveId,
      past: [],
      future: [],
    });
  },

  togglePinCanvas: (id) => {
    const canvases = get().canvases.map((c) =>
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    );
    set({ canvases });
  },

  toggleFavorite: (id) => {
    const canvases = get().canvases.map((c) =>
      c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
    );
    set({ canvases });
  },

  getOpenCanvases: () => {
    const { canvases, openCanvasIds } = get();
    return openCanvasIds
      .map((id) => canvases.find((c) => c.id === id))
      .filter((c): c is CanvasTab => c !== undefined);
  },

  getVisibleCanvases: () => {
    const { canvases, activeCanvasId, openCanvasIds } = get();
    const MAX_VISIBLE = 3;

    const openCanvases = openCanvasIds
      .map((id) => canvases.find((c) => c.id === id))
      .filter((c): c is CanvasTab => c !== undefined);

    if (openCanvases.length <= MAX_VISIBLE) {
      return openCanvases;
    }

    const activeCanvas = openCanvases.find((c) => c.id === activeCanvasId);
    const pinned = openCanvases.filter((c) => c.isPinned && c.id !== activeCanvasId);
    const other = openCanvases.filter((c) => !c.isPinned && c.id !== activeCanvasId);

    const visible: CanvasTab[] = [];

    if (activeCanvas) {
      visible.push(activeCanvas);
    }

    for (const c of pinned) {
      if (visible.length >= MAX_VISIBLE) break;
      visible.push(c);
    }

    const sortedOther = [...other].sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
    for (const c of sortedOther) {
      if (visible.length >= MAX_VISIBLE) break;
      visible.push(c);
    }

    return visible;
  },

  getOverflowCanvases: () => {
    const { canvases, activeCanvasId, openCanvasIds } = get();
    const MAX_VISIBLE = 3;

    const openCanvases = openCanvasIds
      .map((id) => canvases.find((c) => c.id === id))
      .filter((c): c is CanvasTab => c !== undefined);

    if (openCanvases.length <= MAX_VISIBLE) {
      return [];
    }

    const visible = get().getVisibleCanvases();
    const visibleIds = new Set(visible.map((c) => c.id));

    return openCanvases.filter((c) => !visibleIds.has(c.id));
  },

  getActiveCanvasId: () => get().activeCanvasId,

  fitView: (opts) => {
    invokeFitView(opts ?? { padding: 0.0, duration: 400 });
  },
});
