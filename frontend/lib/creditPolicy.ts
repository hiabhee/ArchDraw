export const CREDIT_POLICY = {
  guest: { allowance: 10, periodMs: 24 * 60 * 60 * 1000 },
  authenticated: { allowance: 10, periodMs: 30 * 24 * 60 * 60 * 1000 },
  costs: { 1: 1, 2: 2, 3: 4 },
} as const;

export type DetailLevel = 1 | 2 | 3;
