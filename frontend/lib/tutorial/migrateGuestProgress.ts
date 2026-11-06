import { useTutorialStore } from '@/store/tutorialStore';
import { saveTutorialProgress as apiSaveTutorialProgress } from '@/lib/client/api-client';
import { getTutorialById } from '@/data/tutorials';
import * as engine from '@/lib/tutorial/engine';

/**
 * Save a guest's tutorial progress to their account when they sign in.
 * Loaded on demand by AuthProvider, so the tutorial data is not on every page.
 */
export async function migrateGuestProgress() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
  if (!authEnabled) return;
  const { richProgress, completedTutorials } = useTutorialStore.getState();
  const entries = Object.entries(richProgress);
  if (entries.length === 0 && completedTutorials.length === 0) return;

  const savedIds = new Set<string>();

  for (const [tutorialId, p] of entries) {
    if (!p.currentStep || p.currentStep <= 1) continue;
    savedIds.add(tutorialId);
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

  // Ensure finished tutorials reach the DB even if their progress entry is
  // missing or was reset to step 1 (e.g. partial reset after completion).
  // Completion is inferred by the final step position + celebration phase,
  // matching how `startTutorialByDef` re-derives it on restore.
  for (const tutorialId of completedTutorials) {
    if (savedIds.has(tutorialId)) continue;
    const tutorial = getTutorialById(tutorialId);
    if (!tutorial) continue;
    const totalSteps = engine.getTotalStepCount(tutorial);
    try {
      await apiSaveTutorialProgress({
        tutorialId,
        currentLevel: tutorial.levels.length,
        currentStep: totalSteps,
        currentPhase: 'celebration',
        completedLevels: tutorial.levels.map((_, i) => i + 1),
        completedStepIds: tutorial.levels.flatMap((l) => l.steps.map((s) => s.id)),
        canvasNodes: [],
        canvasEdges: [],
        explainCount: 0,
      });
    } catch {
      // best-effort, never throw
    }
  }
}
