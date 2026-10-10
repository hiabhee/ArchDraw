import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasTab, DiagramState } from '../../types';

const m = vi.hoisted(() => ({
  saveUserCanvas: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/client/api-client', () => ({
  saveUserCanvas: m.saveUserCanvas,
  deleteUserCanvasApi: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: m.toastError, warning: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() } }));

import { debouncedSaveCanvasToDB, flushAllPendingCanvasSaves, flushCanvasSaveToDB } from '../dbSave';

function makeStore(canvases: CanvasTab[]) {
  const state = {
    canvases,
    userProfile: { id: 'u1' },
    savingState: 'idle',
    setSavingState: vi.fn(),
    setCanvasServerVersion: vi.fn((id: string, v: number) => {
      state.canvases = state.canvases.map((c) => (c.id === id ? { ...c, serverUpdatedAt: v } : c));
    }),
    reloadCanvasFromDB: vi.fn(),
  } as unknown as DiagramState;
  return { state, get: () => state };
}

const canvas = (id: string, serverUpdatedAt?: number): CanvasTab => ({ id, name: id, nodes: [], edges: [], serverUpdatedAt });

describe('canvas DB saves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');
    m.saveUserCanvas.mockReset();
    m.toastError.mockReset();
    m.saveUserCanvas.mockImplementation(async () => ({ updatedAt: new Date(5000).toISOString() }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('debounces per canvas, so touching canvas B does not drop canvas A', async () => {
    const { get } = makeStore([canvas('A'), canvas('B')]);
    debouncedSaveCanvasToDB('A', get);
    await vi.advanceTimersByTimeAsync(500);
    debouncedSaveCanvasToDB('B', get);
    await vi.advanceTimersByTimeAsync(2000);
    const savedIds = m.saveUserCanvas.mock.calls.map((c) => c[0].id).sort();
    expect(savedIds).toEqual(['A', 'B']);
  });

  it('sends the last seen server version and records the new one', async () => {
    const { get, state } = makeStore([canvas('A', 1000)]);
    await flushCanvasSaveToDB('A', get);
    expect(m.saveUserCanvas.mock.calls[0][0].baseUpdatedAt).toBe(1000);
    expect(state.canvases[0].serverUpdatedAt).toBe(5000);
  });

  it('serializes saves for one canvas so the second uses the first result as its base', async () => {
    const { get } = makeStore([canvas('A', 1000)]);
    await Promise.all([flushCanvasSaveToDB('A', get), flushCanvasSaveToDB('A', get)]);
    expect(m.saveUserCanvas.mock.calls.map((c) => c[0].baseUpdatedAt)).toEqual([1000, 5000]);
  });

  it('flushes pending debounced saves with keepalive on page hide', async () => {
    const { get } = makeStore([canvas('A')]);
    debouncedSaveCanvasToDB('A', get);
    await flushAllPendingCanvasSaves({ keepalive: true });
    expect(m.saveUserCanvas).toHaveBeenCalledTimes(1);
    expect(m.saveUserCanvas.mock.calls[0][1]).toEqual({ keepalive: true });
    await vi.advanceTimersByTimeAsync(2000);
    expect(m.saveUserCanvas).toHaveBeenCalledTimes(1);
  });

  it('surfaces a conflict with keep-mine / load-theirs instead of overwriting', async () => {
    const conflict = Object.assign(new Error('changed elsewhere'), { status: 409, code: 'CANVAS_CONFLICT' });
    m.saveUserCanvas.mockRejectedValueOnce(conflict);
    const { get } = makeStore([canvas('A', 1000)]);
    await flushCanvasSaveToDB('A', get);
    const opts = m.toastError.mock.calls[0][1];
    expect(opts.action.label).toBe('Keep mine');

    opts.action.onClick();
    await vi.runAllTimersAsync();
    const forced = m.saveUserCanvas.mock.calls[1][0];
    expect(forced.baseUpdatedAt).toBeUndefined();

    opts.cancel.onClick();
    expect(get().reloadCanvasFromDB).toHaveBeenCalledWith('A');
  });
});
