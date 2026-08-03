'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { useTutorialStore } from '@/store/tutorialStore';
import { saveTutorialProgress as apiSaveTutorialProgress } from '@/lib/api-client';
import { STORAGE_KEYS } from '@/lib/config';

const SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function migrateGuestProgress(userId: string) {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
  if (!authEnabled) return;
  const { richProgress } = useTutorialStore.getState();
  const entries = Object.entries(richProgress);
  if (entries.length === 0) return;

  for (const [tutorialId, p] of entries) {
    if (!p.currentStep || p.currentStep <= 1) continue;
    try {
      await apiSaveTutorialProgress({
        tutorialId,
        currentLevel: p.currentLevel,
        currentStep: p.currentStep,
        currentPhase: p.currentPhase,
        completedLevels: p.completedLevels,
        completedStepIds: p.completedStepIds ?? [],
        canvasNodes: p.canvasNodes as object,
        canvasEdges: p.canvasEdges as object,
        explainCount: p.explainCount,
      });
    } catch {
      // best-effort, never throw
    }
  }
}

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

  // Sync user profile to diagram store
  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      prevUserIdRef.current = null;
      useDiagramStore.getState().setUserProfile(null);
      return;
    }

    if (user.id === prevUserIdRef.current) return;
    prevUserIdRef.current = user.id;

    const { setUserProfile, loadCanvasesFromDB } = useDiagramStore.getState();

    if (user.id !== 'guest') {
      setUserProfile({
        id: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        avatar_url: user.image ?? undefined,
      });
      loadCanvasesFromDB().catch(() => {});
      migrateGuestProgress(user.id).catch(() => {});
    } else {
      setUserProfile({
        id: 'guest',
        email: 'guest@local',
        name: 'Guest User',
      });
    }
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
  }, []);

  return <>{children}</>;
}
