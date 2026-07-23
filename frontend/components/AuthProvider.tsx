'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { useTutorialStore } from '@/store/tutorialStore';
import { saveTutorialProgress as apiSaveTutorialProgress } from '@/lib/api-client';
import { STORAGE_KEYS } from '@/lib/config';

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
  const { initialize, user, initialized } = useAuthStore();
  const prevUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      console.log('[AuthProvider] No user, clearing profile');
      prevUserIdRef.current = null;
      useDiagramStore.getState().setUserProfile(null);
      return;
    }

    if (user.id === prevUserIdRef.current) return;
    prevUserIdRef.current = user.id;

    const { setUserProfile, loadCanvasesFromDB } = useDiagramStore.getState();

    if (user.id !== 'guest') {
      console.log('[AuthProvider] Setting authenticated user profile:', { id: user.id, email: user.email, name: user.name });
      setUserProfile({
        id: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        avatar_url: user.image ?? undefined,
      });
      loadCanvasesFromDB().catch(() => {});
      migrateGuestProgress(user.id).catch(() => {});
    } else {
      console.log('[AuthProvider] Setting guest user profile');
      setUserProfile({
        id: 'guest',
        email: 'guest@local',
        name: 'Guest User',
      });
    }
  }, [user, initialized]);

  useEffect(() => {
    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
    if (!initialized || !authEnabled) return;

    // Handle pending actions from session storage (share/download after auth)
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
