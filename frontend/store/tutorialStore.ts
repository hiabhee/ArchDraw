import logger from '@/lib/logger';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { serializedStorage } from '@/lib/storage/localStorage';
import type { Node, Edge } from 'reactflow';
import type { TutorialDefinition, TutorialSession, PhaseName } from '@/lib/tutorial/schema';
import type { AnyTutorial } from '@/data/tutorials';
import * as engine from '@/lib/tutorial/engine';
import { deleteTutorialProgressApi as apiDeleteTutorialProgress, saveTutorialProgress as apiSaveTutorialProgress, fetchTutorialProgress as apiGetTutorialProgress } from '@/lib/api-client';
import { migrateEdgesToSmoothstep } from '@/lib/utils/edgeMigration';

export interface TutorialMessage {
  type: 'guide' | 'user' | 'success' | 'error';
  content: string;
  timestamp: number;
}

export type SanitizedNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; componentId: string; category?: string; color?: string; icon?: string };
};

export type SanitizedEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated: boolean;
  style?: object;
  label?: string;
  data?: { pathType?: string };
};

export interface TutorialProgressEntry {
  tutorialId: string;
  currentLevel: number;
  currentStep: number;
  currentPhase: string;
  completedLevels: number[];
  completedStepIds: string[];
  canvasNodes: SanitizedNode[];
  canvasEdges: SanitizedEdge[];
  explainCount: number;
  updatedAt: string;
}

export type TutorialProgressRow = {
  user_id: string;
  tutorial_id: string;
  current_level: number;
  current_step: number;
  current_phase: string;
  completed_levels: number[];
  completed_step_ids: string[];
  canvas_nodes: SanitizedNode[];
  canvas_edges: SanitizedEdge[];
  explain_count: number;
  updated_at: string;
};

export function sanitizeNode(node: Node): SanitizedNode {
  return {
    id: node.id,
    type: node.type || 'default',
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.data?.label || '',
      componentId: node.data?.componentId || '',
      category: node.data?.category,
      color: node.data?.color,
      icon: node.data?.icon,
    },
  };
}

export function sanitizeEdge(edge: Edge): SanitizedEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'smooth',
    animated: edge.animated || false,
    style: edge.style as object | undefined,
    label: edge.label as string | undefined,
  };
}

const STORAGE_KEY = 'archdraw_tutorial_v2';

interface TutorialStoreState {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  activeTutorial: TutorialDefinition | null;
  session: TutorialSession | null;
  nodes: Node[];
  edges: Edge[];
  messages: TutorialMessage[];
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
  
  richProgress: Record<string, TutorialProgressEntry>;
  isSyncing: boolean;

  // Highlight state for node/edge requirement indicators
  highlightFrom: string | null;
  highlightTo: string | null;
  setHighlight: (from: string | null, to: string | null) => void;

  // Legacy props
  currentStep: number;
  totalSteps: number;
  currentLevel: number;
  completedLevels: number[];
  validationStatus: 'idle' | 'success' | 'error';
  validationError: string;
  isComplete: boolean;
  isLevelComplete: boolean;
  activeTutorialId: string | null;
  tutorialProgress: Record<string, number>;
  tutorialPhase: Record<string, string>;
  tutorialNodes: Node[];
  tutorialEdges: Edge[];
  isSwitchingTutorial: boolean;
  completedTutorials: string[];

  // Actions
  startTutorial: (id: string, totalSteps: number) => void;
  startTutorialByDef: (tutorial: AnyTutorial) => void;
  advancePhase: () => void;
  advanceManually: () => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setTutorialNodes: (nodes: Node[]) => void;
  setTutorialEdges: (edges: Edge[]) => void;
  clearTutorialCanvas: () => void;
  setValidationStatus: (status: 'idle' | 'success' | 'error', error?: string) => void;
  setIsTyping: (v: boolean) => void;
  addMessage: (type: TutorialMessage['type'], content: string) => void;
  clearMessages: () => void;
  advanceStep: () => void;
  skipStep: () => void;
  completeTutorial: () => void;
  resetTutorial: (id: string) => void;
  startTutorialFresh: (tutorial: AnyTutorial) => Promise<{ success: boolean; error?: string }>;
  exitTutorial: () => void;
  savePhase: (tutorialId: string, step: number, phase: string) => void;
  getPersistedPhase: (tutorialId: string, step: number) => string | null;
  advanceLevel: (nextLevelStepCount: number) => void;
  dismissLevelComplete: () => void;
  saveProgress: (tutorialId: string, progress: Partial<TutorialProgressEntry>) => void;
  getProgress: (tutorialId: string) => TutorialProgressEntry | null;
  getLevelCanvasState: (level: number) => { nodes: Node[]; edges: Edge[] } | null;
  clearProgress: (tutorialId: string) => void;
  clearAllProgress: () => void;
  syncToDb: (tutorialId: string) => Promise<void>;
  loadFromDb: (tutorialId: string) => Promise<TutorialProgressEntry | null>;
  setSwitchingTutorial: (v: boolean) => void;
}

export const useTutorialStore = create<TutorialStoreState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      activeTutorial: null,
      session: null,
      nodes: [],
      edges: [],
      messages: [],
      isTyping: false,
      isLoading: false,
      error: null,

      richProgress: {},
      isSyncing: false,

      highlightFrom: null,
      highlightTo: null,
      setHighlight: (from, to) => set({ highlightFrom: from, highlightTo: to }),

      currentStep: 1,
      totalSteps: 0,
      currentLevel: 1,
      completedLevels: [],
      validationStatus: 'idle',
      validationError: '',
      isComplete: false,
      isLevelComplete: false,
      activeTutorialId: null,
      tutorialProgress: {},
      tutorialPhase: {},
      tutorialNodes: [],
      tutorialEdges: [],
      isSwitchingTutorial: false,
      completedTutorials: [],

      startTutorialByDef: (tutorialInput) => {
        // All tutorials in the TUTORIALS array are TutorialDefinition instances
        const tutorial = tutorialInput as TutorialDefinition;
        const saved = get().richProgress[tutorial.id];
        let session: TutorialSession;
        let restoredNodes: Node[] = [];
        let restoredEdges: Edge[] = [];
        
        const totalStepsCount = tutorial.levels.reduce((acc, l) => acc + l.steps.length, 0);
        
        if (saved) {
          restoredNodes = saved.canvasNodes as Node[];
          restoredEdges = migrateEdgesToSmoothstep(saved.canvasEdges as Edge[]) as Edge[];
          
          session = engine.restoreSession(tutorial, {
            levelIndex: Math.max(0, (saved.currentLevel ?? 1) - 1),
            stepIndex: Math.max(0, (saved.currentStep ?? 1) - 1),
            phase: (saved.currentPhase as PhaseName) ?? 'context',
            completedLevelIds: saved.completedLevels.map(String),
            completedStepIds: saved.completedStepIds ?? [],
            canvasSnapshot: {
              nodes: restoredNodes,
              edges: restoredEdges,
            },
          });
        } else {
          session = engine.initSession(tutorial);
        }

        set({
          activeTutorial: tutorial,
          session,
          nodes: restoredNodes,
          edges: restoredEdges,
          messages: [],
          isLoading: false,
          error: null,
          currentStep: saved?.currentStep ?? 1,
          totalSteps: totalStepsCount,
          currentLevel: saved?.currentLevel ?? 1,
          completedLevels: saved?.completedLevels ?? [],
          activeTutorialId: tutorial.id,
          isComplete: false,
          isLevelComplete: false,
        });
      },

      startTutorial: (id, totalStepsCount) => {
        set({ 
          currentStep: 1, 
          totalSteps: totalStepsCount,
          activeTutorialId: id,
          currentLevel: 1,
        });
      },

      advancePhase: () => {
        const { session, activeTutorial } = get();
        if (session && activeTutorial) {
          const newSession = engine.advancePhase(session, activeTutorial);
          set({ 
            session: newSession,
            currentStep: newSession.stepIndex + 1,
          });
        }
      },

      advanceManually: () => {
        const { session, activeTutorial } = get();
        if (session && activeTutorial) {
          const newSession = engine.forceAdvance(session, activeTutorial);
          set({ 
            session: newSession,
            currentStep: newSession.stepIndex + 1,
          });
        }
      },

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      setTutorialNodes: (nodes) =>
        set({ tutorialNodes: nodes.map(sanitizeNode) as Node[] }),

      setTutorialEdges: (edges) =>
        set({ tutorialEdges: edges.map(sanitizeEdge) as Edge[] }),

      clearTutorialCanvas: () => set({ nodes: [], edges: [] }),

      setValidationStatus: (status, error) => set({ 
        validationStatus: status,
        validationError: error ?? '',
      }),

      setIsTyping: (v) => set({ isTyping: v }),

      addMessage: (type, content) =>
        set((s) => ({
          messages: [...s.messages, { type, content, timestamp: Date.now() }],
        })),

      clearMessages: () => set({ messages: [] }),

      advanceStep: () => {
        const { currentStep, totalSteps, session, activeTutorial } = get();
        if (session && activeTutorial) {
          const newSession = engine.advancePhase(session, activeTutorial);
          set({ 
            session: newSession,
            currentStep: newSession.stepIndex + 1,
            isLevelComplete: newSession.stepIndex >= totalSteps - 1,
          });
        } else {
          set({ currentStep: Math.min(currentStep + 1, totalSteps) });
        }
      },

      skipStep: () => {
        const { currentStep, totalSteps } = get();
        set({ currentStep: Math.min(currentStep + 1, totalSteps) });
      },

      completeTutorial: () => {
        const { activeTutorial } = get();
        set((s) => ({
          isComplete: true,
          completedTutorials: activeTutorial
            ? [...new Set([...s.completedTutorials, activeTutorial.id])]
            : s.completedTutorials,
        }));
      },

      resetTutorial: () => { 
        const { activeTutorial } = get();
        if (activeTutorial) {
          const { clearProgress } = get();
          clearProgress(activeTutorial.id);
          
          const session = engine.initSession(activeTutorial);
          set({ 
            currentStep: 1, 
            currentLevel: 1,
            completedLevels: [],
            nodes: [], 
            edges: [],
            messages: [],
            session,
            isComplete: false,
            isLevelComplete: false,
          });
          
          // Delete from DB
          import('@/store/authStore').then(({ useAuthStore }) => {
            const { user } = useAuthStore.getState();
            if (user && user.id !== 'guest') {
              apiDeleteTutorialProgress(activeTutorial.id).catch(() => {});
            }
          });
        }
      },

      // FIX: Start tutorial fresh - with timeout handling
      startTutorialFresh: async (tutorialInput): Promise<{ success: boolean; error?: string }> => {
        // All tutorials in the TUTORIALS array are TutorialDefinition instances
        const tutorial = tutorialInput as TutorialDefinition;
        const totalStepsCount = tutorial.levels.reduce((acc, l) => acc + l.steps.length, 0);
        
        // Step 1: Clear local state
        const { clearProgress } = get();
        clearProgress(tutorial.id);
        
        // Step 2: Clear tutorial-specific state
        set({
          currentStep: 1,
          currentLevel: 1,
          completedLevels: [],
          nodes: [],
          edges: [],
          messages: [],
          isComplete: false,
          isLevelComplete: false,
        });

        // Step 3: Try to upsert DB with fresh state (with timeout)
        try {
          const { useAuthStore } = await import('@/store/authStore');
          const { user } = useAuthStore.getState();
          if (user && user.id !== 'guest') {
            await apiSaveTutorialProgress({
              tutorialId: tutorial.id,
              currentLevel: 1,
              currentStep: 1,
              currentPhase: 'context',
              completedLevels: [],
              completedStepIds: [],
              canvasNodes: [],
              canvasEdges: [],
              explainCount: 0,
            });
          }
        } catch (e) {
          logger.warn('[tutorialStore] DB save failed, continuing locally:', e instanceof Error ? e.message : String(e));
        }

        // Start fresh locally (either DB not configured, auth timed out, or no user)
        const session = engine.initSession(tutorial);
        set({
          activeTutorial: tutorial,
          session,
          currentStep: 1,
          currentLevel: 1,
          completedLevels: [],
          totalSteps: totalStepsCount,
          activeTutorialId: tutorial.id,
          isComplete: false,
          isLevelComplete: false,
        });

        return { success: true };
      },

      savePhase: (tutorialId, step, phase) => {
        set((s) => ({
          tutorialPhase: { ...s.tutorialPhase, [`${tutorialId}-${step}`]: phase },
        }));
      },

      getPersistedPhase: (tutorialId, step) => {
        return get().tutorialPhase[`${tutorialId}-${step}`] ?? null;
      },

      advanceLevel: (nextLevelStepCount) => {
        const { currentLevel, completedLevels } = get();
        set({
          currentLevel: currentLevel + 1,
          currentStep: 1,
          completedLevels: [...completedLevels, currentLevel],
          isLevelComplete: false,
          totalSteps: nextLevelStepCount,
        });
      },

      dismissLevelComplete: () => set({ isLevelComplete: false }),

      saveProgress: (tutorialId, progress) => {
        set((state) => ({
          richProgress: {
            ...state.richProgress,
            [tutorialId]: {
              tutorialId,
              currentLevel: progress.currentLevel ?? state.currentLevel,
              currentStep: progress.currentStep ?? state.currentStep,
              currentPhase: progress.currentPhase ?? 'context',
              completedLevels: progress.completedLevels ?? state.completedLevels,
              completedStepIds: progress.completedStepIds ?? state.richProgress[tutorialId]?.completedStepIds ?? [],
              canvasNodes: (progress.canvasNodes ?? state.tutorialNodes) as SanitizedNode[],
              canvasEdges: (progress.canvasEdges ?? state.tutorialEdges) as SanitizedEdge[],
              explainCount: progress.explainCount ?? 0,
              updatedAt: progress.updatedAt ?? new Date().toISOString(),
            },
          },
        }));
      },

      getProgress: (tutorialId) => {
        return get().richProgress[tutorialId] ?? null;
      },

      getLevelCanvasState: (level) => {
        const progress = get().richProgress[get().activeTutorialId ?? ''];
        if (progress?.currentLevel === level) {
          return {
            nodes: progress.canvasNodes as Node[],
            edges: progress.canvasEdges as Edge[],
          };
        }
        return null;
      },

      clearProgress: (tutorialId) => {
        set((state) => {
          const newRichProgress = { ...state.richProgress };
          delete newRichProgress[tutorialId];
          return { richProgress: newRichProgress };
        });
      },

      clearAllProgress: () => set({ richProgress: {} }),

      syncToDb: async (tutorialId) => {
        const progress = get().richProgress[tutorialId];
        if (!progress) return;
        
        try {
          const { user } = (await import('@/store/authStore')).useAuthStore.getState();
          if (!user || user.id === 'guest') return;

          set({ isSyncing: true });
          await apiSaveTutorialProgress({
            tutorialId,
            currentLevel: progress.currentLevel,
            currentStep: progress.currentStep,
            currentPhase: progress.currentPhase,
            completedLevels: progress.completedLevels,
            completedStepIds: progress.completedStepIds,
            canvasNodes: progress.canvasNodes as object,
            canvasEdges: progress.canvasEdges as object,
            explainCount: progress.explainCount,
          });
        } catch (e) {
          logger.error('[tutorialStore] Sync to DB failed:', e);
          return;
        } finally {
          set({ isSyncing: false });
        }
      },

      loadFromDb: async (tutorialId) => {
        try {
          const { user } = (await import('@/store/authStore')).useAuthStore.getState();
          if (!user || user.id === 'guest') return null;

          const data = await apiGetTutorialProgress(tutorialId);

          if (!data) return null;

          const progress: TutorialProgressEntry = {
            tutorialId: data.tutorialId,
            currentLevel: data.currentLevel,
            currentStep: data.currentStep,
            currentPhase: data.currentPhase,
            completedLevels: data.completedLevels,
            completedStepIds: data.completedStepIds ?? [],
            canvasNodes: (data.canvasNodes as unknown as SanitizedNode[]) ?? [],
            canvasEdges: migrateEdgesToSmoothstep(data.canvasEdges as unknown as Edge[]) as unknown as SanitizedEdge[],
            explainCount: data.explainCount,
            updatedAt: data.updatedAt?.toISOString() ?? new Date().toISOString(),
          };

          get().saveProgress(tutorialId, progress);
          return progress;
        } catch (e) {
          logger.error('[tutorialStore] Load from DB failed:', e);
          return null;
        }
      },

      setSwitchingTutorial: (v) => set({ isSwitchingTutorial: v }),

      exitTutorial: () => {
        const { activeTutorial, session, nodes, edges } = get();
        if (activeTutorial && session) {
          get().saveProgress(activeTutorial.id, {
            currentLevel: session.levelIndex + 1,
            currentStep: session.stepIndex + 1,
            currentPhase: session.phase,
            completedLevels: session.completedLevelIds.map(Number),
            completedStepIds: session.completedStepIds,
            canvasNodes: nodes.map(sanitizeNode),
            canvasEdges: edges.map(sanitizeEdge),
            explainCount: 0,
            updatedAt: new Date().toISOString(),
          });
        }
        set({
          activeTutorial: null,
          session: null,
          nodes: [],
          edges: [],
          messages: [],
          isComplete: false,
          isLevelComplete: false,
          currentStep: 1,
          totalSteps: 0,
          currentLevel: 1,
          completedLevels: [],
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => serializedStorage),
      partialize: (state) => ({
        richProgress: state.richProgress,
        tutorialProgress: state.tutorialProgress,
        tutorialPhase: state.tutorialPhase,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const useTutorialHelpers = () => {
  const activeTutorial = useTutorialStore((s) => s.activeTutorial);
  const session = useTutorialStore((s) => s.session);

  if (!activeTutorial || !session) {
    return {
      currentStep: null,
      currentPhase: null,
      progress: { percent: 0, stepLabel: '', levelLabel: '' },
      isComplete: false,
    };
  }

  const currentStep = engine.getCurrentStep(session, activeTutorial);
  const currentPhase = engine.getCurrentPhase(session, activeTutorial);
  const progress = engine.getProgress(session, activeTutorial);
  const isComplete = engine.isTutorialComplete(session, activeTutorial);

  return { currentStep, currentPhase, progress, isComplete };
};
