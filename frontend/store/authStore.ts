import { create } from 'zustand';
import { authClient } from '@/lib/client/auth-client';
import { analytics } from '@/lib/client/analytics';
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

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>['data'];

/**
 * Session lookup that tells "signed out" apart from "could not check". A
 * database outage or rate limit returns 5xx/429; treating that as "no
 * session" signed users out during a blip.
 */
async function readSession(): Promise<SessionData | 'unavailable'> {
  try {
    const { data, error } = await authClient.getSession();
    const status = (error as { status?: number } | null)?.status;
    if (error && (status === undefined || status >= 500 || status === 429)) return 'unavailable';
    return data;
  } catch {
    return 'unavailable'; // network error
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const session = await readSession();
      // Could not check (server or network trouble): keep the current user.
      if (session === 'unavailable') return get().user !== null && get().user?.id !== 'guest';

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
      // A visibility-triggered refresh can race a local dev-server restart.
      // The caller treats this as a best-effort check, so don't surface a
      // caught network interruption as a blocking Next.js error overlay.
      logger.warn('[Auth] Session refresh unavailable:', err);
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
      // A blip at page load should not drop a signed-in user to guest: retry
      // a few times before giving up.
      let session = await readSession();
      for (const delay of [1500, 4000, 8000]) {
        if (session !== 'unavailable') break;
        await sleep(delay);
        session = await readSession();
      }
      if (session === 'unavailable') session = null;

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
