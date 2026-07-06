'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { useTutorialStore } from '@/store/tutorialStore';
import { toast } from 'sonner';
import { isSupabaseConfigured, getSupabaseClient, isReachable, type TutorialProgressTable, type UserCanvasesTable } from '@/lib/supabase';
import { STORAGE_KEYS } from '@/lib/config';

async function migrateGuestProgress(userId: string) {
  if (!isSupabaseConfigured || !isReachable) return;
  const { richProgress } = useTutorialStore.getState();
  const entries = Object.entries(richProgress);
  if (entries.length === 0) return;

  const supabase = getSupabaseClient();
  for (const [tutorialId, progress] of entries) {
    if (!progress.currentStep || progress.currentStep <= 1) continue;
    try {
      await (supabase.from('tutorial_progress') as any as TutorialProgressTable).upsert(
        {
          user_id: userId,
          tutorial_id: tutorialId,
          current_level: progress.currentLevel,
          current_step: progress.currentStep,
          current_phase: progress.currentPhase,
          completed_levels: progress.completedLevels,
          canvas_nodes: progress.canvasNodes as any,
          canvas_edges: progress.canvasEdges as any,
          explain_count: progress.explainCount,
          updated_at: progress.updatedAt || new Date().toISOString(),
        },
        { onConflict: 'user_id,tutorial_id' }
      );
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
      prevUserIdRef.current = null;
      useDiagramStore.getState().setUserProfile(null);
      return;
    }
    
    if (user.id === prevUserIdRef.current) return;
    prevUserIdRef.current = user.id;

    // Set user profile and load canvases when user is found
    const { setUserProfile, loadCanvasesFromDB } = useDiagramStore.getState();
    
    if (user.id !== 'guest') {
      setUserProfile({
        id: user.id,
        email: user.email ?? undefined,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined,
        avatar_url: user.user_metadata?.avatar_url ?? undefined,
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

  useEffect(() => {
    if (!initialized || !isSupabaseConfigured) return;
    
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
    if (!isReachable || isOffline) return;
    
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const { setUserProfile, loadCanvasesFromDB } = useDiagramStore.getState();
      
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const u = session.user;
        setUserProfile({
          id: u.id,
          email: u.email ?? undefined,
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
          avatar_url: u.user_metadata?.avatar_url ?? undefined,
        });
        // Check and migrate guest canvas if it has nodes
        let newCanvasId: string | null = null;
        const guestListRaw = localStorage.getItem(STORAGE_KEYS.guestCanvases);
        const legacyRaw = localStorage.getItem('archdraw-guest-canvas');
        const candidates: Record<string, unknown>[] = [];

        try {
          const list = guestListRaw ? JSON.parse(guestListRaw) : null;
          if (Array.isArray(list)) candidates.push(...list);
        } catch {
          // ignore
        }
        try {
          if (legacyRaw) {
            const single = JSON.parse(legacyRaw);
            if (single) candidates.push(single);
          }
        } catch {
          // ignore
        }

        const toMigrate = candidates
          .filter((c) => c && Array.isArray(c.nodes) && c.nodes.length > 0)
          .slice(0, 2); // guest max

        if (toMigrate.length > 0) {
          const toastId = toast.loading('Saving your guest diagrams to your account...');
          try {
            const supabaseClient = getSupabaseClient();
            for (const canvas of toMigrate) {
              const id = `canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              await (supabaseClient.from('user_canvases') as any as UserCanvasesTable).upsert({
                id,
                user_id: u.id,
                name: (canvas.name as string) || 'Elephant',
                nodes: canvas.nodes as import('@/types/supabase').Json,
                edges: (canvas.edges as import('@/types/supabase').Json[]) || [],
                updated_at: new Date().toISOString(),
              });
              if (!newCanvasId) newCanvasId = id;
            }
            localStorage.removeItem('archdraw-guest-canvas');
            localStorage.removeItem(STORAGE_KEYS.guestCanvases);
            toast.success('Guest diagram(s) saved to your account!', { id: toastId });
          } catch {
            toast.error('Failed to save guest diagram(s) to account.', { id: toastId });
          }
        }

        await loadCanvasesFromDB();

        // Handle pendingAction from sessionStorage
        const pendingAction = sessionStorage.getItem('pendingAction');
        if (pendingAction) {
          sessionStorage.removeItem('pendingAction');
          // Wait briefly for editor components to load before dispatching
          setTimeout(() => {
            if (pendingAction === 'share') {
              window.dispatchEvent(new CustomEvent('trigger-share'));
            } else if (pendingAction === 'download') {
              window.dispatchEvent(new CustomEvent('trigger-download'));
            }
          }, 800);
        }

        if (newCanvasId) {
          window.location.href = `/editor?canvas=${newCanvasId}`;
        }
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
