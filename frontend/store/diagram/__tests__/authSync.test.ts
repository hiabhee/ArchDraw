import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/client/auth-client', () => ({ authClient: {} }));
vi.mock('@/lib/client/analytics', () => ({ analytics: { identify: vi.fn(), reset: vi.fn(), track: vi.fn() } }));

import { useAuthStore } from '@/store/authStore';
import { installAuthSync } from '../authSync';
import type { DiagramState } from '../types';

const setUserProfile = vi.fn();
const loadCanvasesFromDB = vi.fn(() => Promise.resolve());
const store = { getState: () => ({ setUserProfile, loadCanvasesFromDB }) as unknown as DiagramState };
const user = (id: string) => ({ id, email: `${id}@x.dev`, name: id, image: null }) as never;

describe('installAuthSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, initialized: false, sessionExpired: false } as never);
  });

  it('waits for auth to initialise, then syncs the signed-in user once and loads their canvases', () => {
    const stop = installAuthSync(store);
    expect(setUserProfile).not.toHaveBeenCalled();
    useAuthStore.setState({ initialized: true, user: user('u1') } as never);
    expect(setUserProfile).toHaveBeenCalledWith({ id: 'u1', email: 'u1@x.dev', name: 'u1', avatar_url: undefined });
    expect(loadCanvasesFromDB).toHaveBeenCalledTimes(1);
    // The same user again (a refreshed session object) does not reload.
    useAuthStore.setState({ user: user('u1') } as never);
    expect(loadCanvasesFromDB).toHaveBeenCalledTimes(1);
    stop();
  });

  it('applies the current state when the diagram store loads after sign-in', () => {
    useAuthStore.setState({ initialized: true, user: user('u2') } as never);
    const stop = installAuthSync(store);
    expect(loadCanvasesFromDB).toHaveBeenCalledTimes(1);
    stop();
  });

  it('gives guests the guest profile and clears the profile on sign-out, keeping canvases when the session expired', () => {
    const stop = installAuthSync(store);
    useAuthStore.setState({ initialized: true, user: user('guest') } as never);
    expect(setUserProfile).toHaveBeenLastCalledWith({ id: 'guest', email: 'guest@local', name: 'Guest User' });
    expect(loadCanvasesFromDB).not.toHaveBeenCalled();
    useAuthStore.setState({ user: null, sessionExpired: true } as never);
    expect(setUserProfile).toHaveBeenLastCalledWith(null, { preserveCanvases: true });
    stop();
  });
});
