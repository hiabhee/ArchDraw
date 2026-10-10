import { describe, expect, it } from 'vitest';
import { getGenerationBudget } from './aiCapacity';

describe('AI capacity budgets', () => {
  it('scales planner reservation with detail level', () => {
    const l1 = getGenerationBudget('short prompt', 1);
    const l3 = getGenerationBudget('short prompt', 3);
    expect(l1.maxPlannerTokens).toBeLessThan(l3.maxPlannerTokens);
    expect(l1.estimatedTokens).toBeLessThan(l3.estimatedTokens);
  });

  it('accounts for long prompt input tokens', () => {
    const short = getGenerationBudget('a', 2);
    const long = getGenerationBudget('a'.repeat(4000), 2);
    expect(long.estimatedTokens).toBeGreaterThan(short.estimatedTokens);
  });
});
