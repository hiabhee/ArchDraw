import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import { analytics } from '@/lib/analytics';
import logger from '@/lib/logger';

interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

const GUEST_USER: AuthUser = {
  id: 'guest',
  email: 'guest@local',
  name: 'Guest User',
  image: null,
  emailVerified: false,
  createdAt: new Date(),
};

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  sessionExpired: boolean;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  sessionExpired: false,

  signOut: async () => {
    try {
      await authClient.signOut();
      set({ user: null, sessionExpired: false });
    } catch (err) {
      logger.error('[Auth] Sign out error:', err);
    }
  },

  refreshSession: async () => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!authEnabled) return true;

    try {
      const { data: session } = await authClient.getSession();

      if (session?.user) {
        const u = session.user;
        set({
          user: {
            id: u.id,
            email: u.email ?? null,
            name: u.name ?? null,
            image: u.image ?? null,
            emailVerified: u.emailVerified,
            createdAt: u.createdAt,
          },
          sessionExpired: false,
        });
        return true;
      }

      // Session gone — only mark expired if we previously had a real user
      const prev = get().user;
      if (prev && prev.id !== 'guest') {
        logger.warn('[Auth] Session expired — user was:', prev.email);
        try {
          const { useDiagramStore } = await import('@/store/diagramStore');
          const { flushCanvasSaveToDB } = await import('@/store/diagram/persistence/dbSave');
          const diagramState = useDiagramStore.getState();
          for (const canvas of diagramState.canvases) {
            if ((canvas.nodes?.length ?? 0) > 0 || (canvas.edges?.length ?? 0) > 0) {
              await flushCanvasSaveToDB(canvas.id, () => useDiagramStore.getState());
            }
          }
        } catch {
          // best-effort flush before clearing session
        }
        set({ user: null, sessionExpired: true });
        return false;
      }
      return false;
    } catch (err) {
      logger.error('[Auth] Session refresh failed:', err);
      return false;
    }
  },

  initialize: async () => {
    if (get().initialized) return;

    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

    if (!authEnabled) {
      logger.warn('[Auth] Authentication not enabled - using guest mode');
      set({
        user: GUEST_USER,
        loading: false,
        initialized: true,
      });
      return;
    }

    try {
      const { data: session } = await authClient.getSession();

      if (session?.user) {
        const u = session.user;
        set({
          user: {
            id: u.id,
            email: u.email ?? null,
            name: u.name ?? null,
            image: u.image ?? null,
            emailVerified: u.emailVerified,
            createdAt: u.createdAt,
          },
          loading: false,
          initialized: true,
          sessionExpired: false,
        });
        analytics.identify(u.id);
      } else {
        set({
          user: GUEST_USER,
          loading: false,
          initialized: true,
          sessionExpired: false,
        });
      }
    } catch {
      set({
        user: GUEST_USER,
        loading: false,
        initialized: true,
        sessionExpired: false,
      });
    }
  },
}));
