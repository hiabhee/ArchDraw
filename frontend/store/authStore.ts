import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';

interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  signOut: async () => {
    try {
      await authClient.signOut();
      set({ user: null });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  },

  initialize: async () => {
    if (get().initialized) return;

    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
    if (isOffline || !process.env.DATABASE_URL) {
      set({ user: { id: 'guest', email: 'guest@local', name: 'Guest User', image: null, emailVerified: false, createdAt: new Date() }, loading: false, initialized: true });
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
        });
      } else {
        set({
          user: { id: 'guest', email: 'guest@local', name: 'Guest User', image: null, emailVerified: false, createdAt: new Date() },
          loading: false,
          initialized: true,
        });
      }
    } catch {
      set({
        user: { id: 'guest', email: 'guest@local', name: 'Guest User', image: null, emailVerified: false, createdAt: new Date() },
        loading: false,
        initialized: true,
      });
    }
  },
}));
