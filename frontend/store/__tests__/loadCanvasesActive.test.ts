import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ fetchUserCanvases: vi.fn() }));
const authMock = vi.hoisted(() => ({ user: { id: 'user-1' } }));

vi.mock('@/lib/client/api-client', () => apiMock);
vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => authMock,
    subscribe: () => () => {},
  },
}));

import { useDiagramStore } from '../diagramStore';

const canvasRow = (id: string, name: string) => ({
  id,
  name,
  nodes: [],
  edges: [],
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
});

const tab = (id: string, name: string) => ({
  id,
  name,
  nodes: [],
  edges: [],
  isOpen: true,
  updatedAt: Date.now(),
});

describe('loadCanvasesFromDB keeps the canvas the user chose', () => {
  const previousAuthFlag = process.env.NEXT_PUBLIC_AUTH_ENABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_ENABLED = 'true';
    apiMock.fetchUserCanvases.mockReset();
    useDiagramStore.setState({
      userProfile: { id: 'user-1' },
      canvases: [tab('a', 'First'), tab('b', 'Second'), tab('c', 'Third')],
      openCanvasIds: ['a', 'b', 'c'],
      activeCanvasId: 'c',
      past: [],
      future: [],
    } as never);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_ENABLED = previousAuthFlag;
  });

  it('does not undo a switch the user made while the list was loading', async () => {
    let resolveRows!: (rows: unknown[]) => void;
    apiMock.fetchUserCanvases.mockReturnValue(new Promise((r) => { resolveRows = r; }));

    const loading = useDiagramStore.getState().loadCanvasesFromDB();
    // User clicks "previous" while the account list is still loading.
    useDiagramStore.setState({ activeCanvasId: 'b' } as never);
    resolveRows([canvasRow('a', 'First'), canvasRow('b', 'Second'), canvasRow('c', 'Third')]);
    await loading;

    expect(useDiagramStore.getState().activeCanvasId).toBe('b');
  });

  it('keeps the active canvas when it is not in the server list', async () => {
    apiMock.fetchUserCanvases.mockResolvedValue([canvasRow('a', 'First'), canvasRow('b', 'Second')]);

    await useDiagramStore.getState().loadCanvasesFromDB();

    // 'c' exists only locally, so it is merged in and must stay active (not jump to 'a').
    expect(useDiagramStore.getState().activeCanvasId).toBe('c');
  });

  it('lets a guest switch to a guest canvas created with addCanvas', async () => {
    useDiagramStore.setState({
      userProfile: { id: 'guest' },
      canvases: [
        { ...tab('guest-canvas', 'Elephant') },
        { ...tab('guest-0f3c9a8e-1111-4222-8333-444455556666', 'Second') },
      ],
      openCanvasIds: ['guest-canvas', 'guest-0f3c9a8e-1111-4222-8333-444455556666'],
      activeCanvasId: 'guest-canvas',
    } as never);

    await useDiagramStore.getState().switchCanvas('guest-0f3c9a8e-1111-4222-8333-444455556666');

    expect(useDiagramStore.getState().activeCanvasId).toBe('guest-0f3c9a8e-1111-4222-8333-444455556666');
  });
});
