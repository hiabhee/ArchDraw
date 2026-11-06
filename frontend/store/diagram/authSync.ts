import { useAuthStore } from '@/store/authStore';
import type { DiagramState } from './types';

/**
 * Keeps the diagram store's user profile in step with sign-in and loads the
 * user's canvases when they sign in. Installed by the diagram store itself
 * (after it has rehydrated), so pages that never use the diagram store, like
 * the landing, do not load the diagram engine just to sync a profile.
 */
export function installAuthSync(store: { getState: () => DiagramState }): () => void {
  let prevUserId: string | null = null;
  const apply = () => {
    const { user, initialized, sessionExpired } = useAuthStore.getState();
    if (!initialized) return;
    const { setUserProfile, loadCanvasesFromDB } = store.getState();
    if (!user) {
      prevUserId = null;
      setUserProfile(null, { preserveCanvases: sessionExpired });
      return;
    }
    if (user.id === prevUserId) return;
    prevUserId = user.id;
    if (user.id !== 'guest') {
      setUserProfile({
        id: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        avatar_url: user.image ?? undefined,
      });
      loadCanvasesFromDB().catch(() => {});
    } else {
      setUserProfile({ id: 'guest', email: 'guest@local', name: 'Guest User' });
    }
  };
  apply();
  return useAuthStore.subscribe((state, prev) => {
    if (state.user !== prev.user || state.initialized !== prev.initialized) apply();
  });
}
