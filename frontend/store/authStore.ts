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
      logger.error('[Auth] Sign out error:', err);
    }
  },

  initialize: async () => {
    if (get().initialized) return;

    // Check if auth is enabled via public env var (safe for client-side)
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    
    if (!authEnabled) {
      logger.warn('[Auth] Authentication not enabled - using guest mode');
      set({ 
        user: { 
          id: 'guest', 
          email: 'guest@local', 
          name: 'Guest User', 
          image: null, 
          emailVerified: false, 
          createdAt: new Date() 
        }, 
        loading: false, 
        initialized: true 
      });
      return;
    }

    try {
      const { data: session } = await authClient.getSession();
      
      console.log('[Auth] Session check result:', session ? 'Session found' : 'No session');
      if (session?.user) {
        console.log('[Auth] User data:', { id: session.user.id, email: session.user.email, name: session.user.name });
      }

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
        analytics.identify(u.id);
      } else {
        // No active session - use guest mode
        logger.info('[Auth] No active session - using guest mode');
        set({
          user: { 
            id: 'guest', 
            email: 'guest@local', 
            name: 'Guest User', 
            image: null, 
            emailVerified: false, 
            createdAt: new Date() 
          },
          loading: false,
          initialized: true,
        });
      }
    } catch (error) {
      // Auth check failed - log error and fall back to guest mode
      logger.error('[Auth] Session check failed, falling back to guest mode:', error);
      set({
        user: { 
          id: 'guest', 
          email: 'guest@local', 
          name: 'Guest User', 
          image: null, 
          emailVerified: false, 
          createdAt: new Date() 
        },
        loading: false,
        initialized: true,
      });
    }
  },
}));
