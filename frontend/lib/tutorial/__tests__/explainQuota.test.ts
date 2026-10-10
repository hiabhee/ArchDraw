import { describe, expect, it } from 'vitest';
import {
  AUTH_EXPLAIN_LIMIT_PER_STEP,
  canRequestExplain,
  nextExplainVariantIndex,
} from '@/lib/tutorial/explainQuota';

describe('explainQuota', () => {
  it('denies guests entirely', () => {
    const result = canRequestExplain({
      isAuthenticated: false,
      stepExplainCounts: {},
      stepId: 'step-1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Sign in');
  });

  it('allows authenticated users up to per-step limit', () => {
    expect(
      canRequestExplain({
        isAuthenticated: true,
        stepExplainCounts: { 'step-1': AUTH_EXPLAIN_LIMIT_PER_STEP - 1 },
        stepId: 'step-1',
      }).allowed
    ).toBe(true);

    expect(
      canRequestExplain({
        isAuthenticated: true,
        stepExplainCounts: { 'step-1': AUTH_EXPLAIN_LIMIT_PER_STEP },
        stepId: 'step-1',
      }).allowed
    ).toBe(false);
  });

  it('uses step explain count as next variant index', () => {
    expect(nextExplainVariantIndex({ 'step-1': 2 }, 'step-1')).toBe(2);
    expect(nextExplainVariantIndex(undefined, 'step-2')).toBe(0);
  });
});
