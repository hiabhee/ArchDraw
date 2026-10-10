import { describe, expect, it } from 'vitest';
import { CREDIT_POLICY } from './creditPolicy';

describe('credit policy', () => {
  it('charges progressively more for detailed diagrams', () => {
    expect(CREDIT_POLICY.costs[1]).toBe(1);
    expect(CREDIT_POLICY.costs[2]).toBe(2);
    expect(CREDIT_POLICY.costs[3]).toBe(4);
  });

  it('starts each tier with ten credits', () => {
    expect(CREDIT_POLICY.guest.allowance).toBe(10);
    expect(CREDIT_POLICY.authenticated.allowance).toBe(10);
  });
});
