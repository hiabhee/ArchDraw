import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  fetchProjectLive: vi.fn(),
  hasPendingCanvasSave: vi.fn(),
  reloadCanvasFromDB: vi.fn(),
  setState: vi.fn(),
  canvases: [] as Array<{ id: string; serverUpdatedAt?: number }>,
}));
vi.mock('@/lib/client/api-client', () => ({ fetchProjectLive: m.fetchProjectLive }));
vi.mock('@/store/diagram/persistence/dbSave', () => ({ hasPendingCanvasSave: m.hasPendingCanvasSave }));
vi.mock('@/store/diagramStore', () => ({
  useDiagramStore: {
    getState: () => ({ canvases: m.canvases, reloadCanvasFromDB: m.reloadCanvasFromDB }),
    setState: m.setState,
  },
}));

import { useProjectLiveStore } from '../projectLiveStore';

const snapshot = (canvasUpdatedAt: number) => ({
  canvasId: 'c1',
  isProject: true,
  agenticProjectId: 'p1',
  workspaceId: 'w1',
  repositoryRemote: null,
  canvasUpdatedAt,
  serverTime: 1_000,
  sessions: [
    {
      id: 's', sessionKey: 'k', label: 'feat/x', branch: 'feat/x', status: 'active', intent: null,
      currentComponentId: 'n1', touched: { n1: { count: 1, lastAt: 990 } }, unmappedPaths: [],
      startedAt: 0, lastSeenAt: 1_000, color: '#2563eb', lastChange: null,
    },
  ],
});

describe('projectLiveStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    m.canvases = [{ id: 'c1', serverUpdatedAt: 500 }];
    m.hasPendingCanvasSave.mockReturnValue(false);
  });
  afterEach(() => {
    useProjectLiveStore.getState().stop();
    vi.useRealTimers();
  });

  it('builds node activity without writing to the diagram store', async () => {
    m.fetchProjectLive.mockResolvedValue(snapshot(500));
    useProjectLiveStore.getState().start('c1');
    await vi.waitFor(() => expect(useProjectLiveStore.getState().snapshot).not.toBeNull());
    expect(useProjectLiveStore.getState().nodeActivity.n1.sessions[0].sessionKey).toBe('k');
    expect(useProjectLiveStore.getState().nodeActivity.n1.recent).toBe(true);
    expect(m.setState).not.toHaveBeenCalled();
    expect(m.reloadCanvasFromDB).not.toHaveBeenCalled();
  });

  it('reloads the canvas when the server copy is newer and nothing is pending', async () => {
    m.fetchProjectLive.mockResolvedValue(snapshot(900));
    useProjectLiveStore.getState().start('c1');
    await vi.waitFor(() => expect(m.reloadCanvasFromDB).toHaveBeenCalledWith('c1'));
  });

  it('does not reload over unsaved local edits', async () => {
    m.hasPendingCanvasSave.mockReturnValue(true);
    m.fetchProjectLive.mockResolvedValue(snapshot(900));
    useProjectLiveStore.getState().start('c1');
    await vi.waitFor(() => expect(useProjectLiveStore.getState().snapshot).not.toBeNull());
    expect(m.reloadCanvasFromDB).not.toHaveBeenCalled();
  });

  it('polls again after the interval and stops cleanly', async () => {
    m.fetchProjectLive.mockResolvedValue(snapshot(500));
    useProjectLiveStore.getState().start('c1');
    await vi.waitFor(() => expect(m.fetchProjectLive).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(m.fetchProjectLive).toHaveBeenCalledTimes(2);
    useProjectLiveStore.getState().stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(m.fetchProjectLive).toHaveBeenCalledTimes(2);
    expect(useProjectLiveStore.getState().nodeActivity).toEqual({});
  });
});
