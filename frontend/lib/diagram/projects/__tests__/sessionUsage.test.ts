import { describe, expect, it } from 'vitest';
import {
  UNPLACED,
  addToComponent,
  addUsage,
  diffUsage,
  emptyUsage,
  estimateCostUsd,
  formatTokens,
  formatUsd,
  parseUsage,
  parseUsageByComponent,
  totalTokens,
} from '../sessionUsage';

const usage = (over: Partial<ReturnType<typeof emptyUsage>> = {}) => ({ ...emptyUsage(), ...over });

describe('parseUsage', () => {
  it('accepts counts and fills the missing fields with zero', () => {
    expect(parseUsage({ input: 10, output: 5.4 })).toEqual(usage({ input: 10, output: 5 }));
  });
  it('rejects anything that is not non-negative finite numbers', () => {
    expect(parseUsage(null)).toBeNull();
    expect(parseUsage([])).toBeNull();
    expect(parseUsage({})).toBeNull();
    expect(parseUsage({ input: -1 })).toBeNull();
    expect(parseUsage({ input: '5' })).toBeNull();
    expect(parseUsage({ input: Infinity })).toBeNull();
    expect(parseUsage({ input: 1e14 })).toBeNull();
  });
});

describe('usage arithmetic', () => {
  it('adds, diffs and clamps a counter that went backwards', () => {
    expect(addUsage(usage({ input: 1, cacheRead: 2 }), usage({ input: 3 }))).toEqual(usage({ input: 4, cacheRead: 2 }));
    expect(diffUsage(usage({ input: 10, output: 4 }), usage({ input: 6, output: 9 }))).toEqual(usage({ input: 4 }));
    expect(totalTokens(usage({ input: 1, output: 2, cacheWrite5m: 3, cacheWrite1h: 4, cacheRead: 5 }))).toBe(15);
  });
  it('books tokens on a component, or on the unplaced bucket', () => {
    let by = addToComponent({}, 'api', usage({ output: 5 }));
    by = addToComponent(by, 'api', usage({ output: 2 }));
    by = addToComponent(by, null, usage({ input: 1 }));
    expect(by.api.output).toBe(7);
    expect(by[UNPLACED].input).toBe(1);
    expect(addToComponent(by, 'x', emptyUsage())).toBe(by);
  });
  it('drops invalid entries of a stored map', () => {
    expect(parseUsageByComponent({ a: { input: 1 }, b: 'x', c: { input: -2 } })).toEqual({ a: usage({ input: 1 }) });
    expect(parseUsageByComponent('nope')).toEqual({});
  });
});

describe('estimateCostUsd', () => {
  it('prices each token kind by the model family', () => {
    // Opus 5.5: $4 in, $20 out, $0.20 cache read; writes 1.25x (5m) and 2x (1h) of input.
    const u = usage({ input: 1e6, output: 1e6, cacheWrite5m: 1e6, cacheWrite1h: 1e6, cacheRead: 1e6 });
    expect(estimateCostUsd(u, 'claude-opus-5-5')).toBeCloseTo(4 + 20 + 5 + 8 + 0.2, 6);
  });
  it('is null for a model without a known price or no model', () => {
    expect(estimateCostUsd(usage({ input: 1 }), 'gpt-9')).toBeNull();
    expect(estimateCostUsd(usage({ input: 1 }), null)).toBeNull();
  });
});

describe('formatting', () => {
  it('shortens tokens and dollars', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(48_000)).toBe('48k');
    expect(formatTokens(2_300_000)).toBe('2.30M');
    expect(formatUsd(0.004)).toBe('<$0.01');
    expect(formatUsd(1.234)).toBe('$1.23');
    expect(formatUsd(42.6)).toBe('$43');
  });
});
