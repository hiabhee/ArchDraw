import type { PhaseName } from '@/lib/tutorial/schema';

export const EXPLAIN_PHASES = ['intro', 'teaching'] as const;
export type ExplainPhase = (typeof EXPLAIN_PHASES)[number];

export const AUTH_EXPLAIN_LIMIT_PER_STEP = 3;

export function isExplainPhase(phase: PhaseName): phase is ExplainPhase {
  return EXPLAIN_PHASES.includes(phase as ExplainPhase);
}

export function explainOverrideKey(stepId: string, phase: ExplainPhase): string {
  return `${stepId}:${phase}`;
}

export function getStepExplainCount(
  stepExplainCounts: Record<string, number> | undefined,
  stepId: string
): number {
  return stepExplainCounts?.[stepId] ?? 0;
}

export function canRequestExplain(opts: {
  isAuthenticated: boolean;
  stepExplainCounts: Record<string, number> | undefined;
  stepId: string;
}): { allowed: boolean; reason?: string } {
  const { isAuthenticated, stepExplainCounts, stepId } = opts;

  if (!isAuthenticated) {
    return {
      allowed: false,
      reason: 'Sign in to use “Explain differently”.',
    };
  }

  const stepCount = getStepExplainCount(stepExplainCounts, stepId);
  if (stepCount >= AUTH_EXPLAIN_LIMIT_PER_STEP) {
    return {
      allowed: false,
      reason: `You’ve used all ${AUTH_EXPLAIN_LIMIT_PER_STEP} explains for this step.`,
    };
  }

  return { allowed: true };
}

export function nextExplainVariantIndex(
  stepExplainCounts: Record<string, number> | undefined,
  stepId: string
): number {
  return getStepExplainCount(stepExplainCounts, stepId);
}
