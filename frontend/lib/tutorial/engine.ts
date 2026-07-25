import type { Node, Edge } from 'reactflow';
import type { TutorialDefinition, TutorialSession, PhaseName, ValidationRule, TutorialStep, PhaseContent } from './schema';
import { PHASE_ORDER, getNextPhase } from './schema';
import { validateRules } from './detection';

export function initSession(tutorial: TutorialDefinition): TutorialSession {
  return {
    tutorialId: tutorial.id,
    levelIndex: 0,
    stepIndex: 0,
    phase: 'context',
    completedStepIds: [],
    completedLevelIds: [],
    canvasSnapshot: { nodes: [], edges: [] },
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

export function getCurrentStep(
  session: TutorialSession,
  tutorial: TutorialDefinition
): TutorialStep | null {
  const level = tutorial.levels[session.levelIndex];
  if (!level) return null;
  return level.steps[session.stepIndex] ?? null;
}

export function getCurrentPhase(
  session: TutorialSession,
  tutorial: TutorialDefinition
): PhaseContent | null {
  const step = getCurrentStep(session, tutorial);
  if (!step) return null;
  return step.phases[session.phase] ?? null;
}

export function getProgress(
  session: TutorialSession,
  tutorial: TutorialDefinition
): { percent: number; stepLabel: string; levelLabel: string } {
  const totalSteps = tutorial.levels.reduce((acc, level) => acc + level.steps.length, 0);
  const completedSteps = session.completedStepIds.length;
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  
  const currentStep = getCurrentStep(session, tutorial);
  const currentLevel = tutorial.levels[session.levelIndex];
  
  return {
    percent,
    stepLabel: currentStep?.title ?? '',
    levelLabel: currentLevel?.title ?? '',
  };
}

export function isLastStep(
  session: TutorialSession,
  tutorial: TutorialDefinition
): boolean {
  const level = tutorial.levels[session.levelIndex];
  if (!level) return true;
  return session.stepIndex === level.steps.length - 1;
}

export function isLastLevel(
  session: TutorialSession,
  tutorial: TutorialDefinition
): boolean {
  return session.levelIndex === tutorial.levels.length - 1;
}

export function isTutorialComplete(
  session: TutorialSession,
  tutorial: TutorialDefinition
): boolean {
  return isLastLevel(session, tutorial) && isLastStep(session, tutorial) && session.phase === 'celebration';
}

export function advancePhase(session: TutorialSession, tutorial: TutorialDefinition): TutorialSession {
  const currentStep = getCurrentStep(session, tutorial);
  const skipPhases = (currentStep as TutorialStep & { skipPhases?: string[] })?.skipPhases ?? [];

  let nextPhase = getNextPhase(session.phase);

  // Keep skipping phases marked for auto-advance
  while (nextPhase !== null && skipPhases.includes(nextPhase)) {
    nextPhase = getNextPhase(nextPhase);
  }

  if (nextPhase === null) {
    if (session.phase === 'celebration') {
      return moveToNextStep(session, tutorial);
    }
    return session;
  }

  if (nextPhase === 'context') {
    return moveToNextStep(session, tutorial);
  }

  return {
    ...session,
    phase: nextPhase,
    lastActivityAt: Date.now(),
  };
}

function moveToNextStep(session: TutorialSession, tutorial: TutorialDefinition): TutorialSession {
  const currentStep = getCurrentStep(session, tutorial);
  if (!currentStep) return session;

  const newCompletedSteps = [...session.completedStepIds, currentStep.id];
  
  let newLevelIndex = session.levelIndex;
  let newStepIndex = session.stepIndex + 1;
  let newCompletedLevels = session.completedLevelIds;

  const currentLevel = tutorial.levels[session.levelIndex];
  if (currentLevel && newStepIndex >= currentLevel.steps.length) {
    newCompletedLevels = [...newCompletedLevels, currentLevel.id];
    newStepIndex = 0;
    newLevelIndex = newLevelIndex + 1;
    
    if (newLevelIndex >= tutorial.levels.length) {
      return {
        ...session,
        completedStepIds: newCompletedSteps,
        completedLevelIds: newCompletedLevels,
        phase: 'celebration',
        lastActivityAt: Date.now(),
      };
    }
  }

  return {
    ...session,
    levelIndex: newLevelIndex,
    stepIndex: newStepIndex,
    phase: 'context',
    completedStepIds: newCompletedSteps,
    completedLevelIds: newCompletedLevels,
    lastActivityAt: Date.now(),
  };
}

export function checkValidation(
  session: TutorialSession,
  tutorial: TutorialDefinition,
  nodes: Node[],
  edges: Edge[]
): { passed: boolean; unmetRules: ValidationRule[]; shouldAdvance: boolean } {
  const step = getCurrentStep(session, tutorial);
  if (!step) {
    return { passed: false, unmetRules: [], shouldAdvance: false };
  }

  if (session.phase !== 'action' && session.phase !== 'connecting') {
    return { passed: false, unmetRules: [], shouldAdvance: false };
  }

  const result = validateRules(step.validation, nodes, edges);
  
  if (result.passed) {
    return { 
      passed: true, 
      unmetRules: [], 
      shouldAdvance: true 
    };
  }

  return { 
    passed: false, 
    unmetRules: result.unmetRules, 
    shouldAdvance: false 
  };
}

export function forceAdvance(session: TutorialSession, tutorial: TutorialDefinition): TutorialSession {
  return advancePhase(session, tutorial);
}

export function resetSession(tutorial: TutorialDefinition): TutorialSession {
  return initSession(tutorial);
}

export function restoreSession(
  tutorial: TutorialDefinition,
  saved: Partial<TutorialSession>
): TutorialSession {
  const defaults = initSession(tutorial);
  return { ...defaults, ...saved };
}
