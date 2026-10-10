import type { TutorialDefinition } from './schema';

/**
 * Structural view of a saved progress entry. Defined locally so this module
 * never imports the Zustand store (avoids a circular dependency) while staying
 * assignable from `richProgress` values.
 */
export interface ProgressEntryShape {
  tutorialId?: string;
  currentLevel?: number;
  currentStep?: number;
  currentPhase?: string;
  completedLevels?: number[];
  completedStepIds?: string[];
  canvasNodes?: unknown[];
  canvasEdges?: unknown[];
  explainCount?: number;
  updatedAt?: string;
}

export type TutorialCardStatus = 'not_started' | 'in_progress' | 'completed';

export interface TutorialProgressMeta {
  status: TutorialCardStatus;
  /** Percentage of total steps completed, 0–100. */
  percent: number;
  completedStepIds: string[];
  completedLevelIds: number[];
  /** 1-indexed */
  currentLevel: number;
  /** 1-indexed */
  currentStep: number;
}

export function getTotalStepCount(tutorial: TutorialDefinition): number {
  return tutorial.levels.reduce((acc, level) => acc + level.steps.length, 0);
}

function hasMeaningfulProgress(entry: ProgressEntryShape | undefined): boolean {
  if (!entry) return false;
  if ((entry.completedStepIds?.length ?? 0) > 0) return true;
  if ((entry.canvasNodes?.length ?? 0) > 0) return true;
  if ((entry.currentLevel ?? 1) > 1) return true;
  if ((entry.currentStep ?? 1) > 1) return true;
  return false;
}

/**
 * Single source of truth for how a tutorial card should look in any catalog
 * (`/tutorials`, `/dashboard/learn`). Replaces the legacy `tutorialProgress`
 * reads and the level-0-only percent approximation.
 */
export function getTutorialProgressMeta(
  tutorial: TutorialDefinition,
  richProgress: Record<string, ProgressEntryShape>,
  completedTutorials: string[]
): TutorialProgressMeta {
  const entry = richProgress[tutorial.id];
  const totalSteps = getTotalStepCount(tutorial);

  if (completedTutorials.includes(tutorial.id)) {
    return {
      status: 'completed',
      percent: 100,
      completedStepIds: entry?.completedStepIds ?? [],
      completedLevelIds: entry?.completedLevels ?? [],
      currentLevel: entry?.currentLevel ?? tutorial.levels.length,
      currentStep: entry?.currentStep ?? totalSteps,
    };
  }

  if (!hasMeaningfulProgress(entry)) {
    return {
      status: 'not_started',
      percent: 0,
      completedStepIds: [],
      completedLevelIds: [],
      currentLevel: 1,
      currentStep: 1,
    };
  }

  const completedCount = entry?.completedStepIds?.length ?? 0;
  const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  return {
    status: 'in_progress',
    percent,
    completedStepIds: entry?.completedStepIds ?? [],
    completedLevelIds: entry?.completedLevels ?? [],
    currentLevel: entry?.currentLevel ?? 1,
    currentStep: entry?.currentStep ?? 1,
  };
}
