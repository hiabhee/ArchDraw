'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

const SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, user, initialized, refreshSession, sessionExpired } = useAuthStore();
  const prevUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const hadRealUserRef = useRef(false);

  // Initialize once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initialize();
  }, [initialize]);

  // Track whether we ever had a real (non-guest) user
  useEffect(() => {
    if (user && user.id !== 'guest') {
      hadRealUserRef.current = true;
    }
  }, [user]);

  // Show toast when session expires
  useEffect(() => {
    if (sessionExpired && hadRealUserRef.current) {
      toast.error('Your session expired. Please sign in again.', {
        duration: 8000,
        action: {
          label: 'Sign in',
          onClick: () => window.location.reload(),
        },
      });
    }
  }, [sessionExpired]);

  // The diagram store syncs the profile itself when it is loaded (store/diagram/authSync.ts).
  // A guest's tutorial progress moves to the account on sign-in.
  useEffect(() => {
    if (!initialized || !user || user.id === 'guest' || user.id === prevUserIdRef.current) {
      if (!user) prevUserIdRef.current = null;
      return;
    }
    prevUserIdRef.current = user.id;
    void import('@/lib/tutorial/migrateGuestProgress')
      .then(({ migrateGuestProgress }) => migrateGuestProgress())
      .catch(() => {});
  }, [user, initialized]);

  // Periodic session refresh — keeps the session alive and detects expiration
  useEffect(() => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!initialized || !authEnabled) return;

    const interval = setInterval(() => {
      refreshSession();
    }, SESSION_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [initialized, refreshSession]);

  // Refresh session when user returns to the tab
  useEffect(() => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!initialized || !authEnabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [initialized, refreshSession]);

  // Handle pending actions from session storage (share/download after auth)
  useEffect(() => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!initialized || !authEnabled) return;

    const pendingAction = sessionStorage.getItem('pendingAction');
    if (pendingAction) {
      sessionStorage.removeItem('pendingAction');
      setTimeout(() => {
        if (pendingAction === 'share') {
          window.dispatchEvent(new CustomEvent('trigger-share'));
        } else if (pendingAction === 'download') {
          window.dispatchEvent(new CustomEvent('trigger-download'));
        }
      }, 800);
    }
  }, [initialized]);

  return <>{children}</>;
}
