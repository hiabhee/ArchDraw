import { describe, expect, it } from 'vitest';
import { MIN_MIX_GAIN, searchGroupDirections, type FlowDirection } from '../layout/groupDirectionSearch';

/** A score where flipping some groups helps, others hurts, and the effects add up. */
const additive = (effect: Record<string, number>) => (assignment: ReadonlyMap<string, FlowDirection>) =>
  [...assignment.keys()].reduce((fit, group) => fit * (effect[group] ?? 1), 0.25);

describe('searchGroupDirections', () => {
  it('flips the groups that help and leaves the ones that hurt', () => {
    const result = searchGroupDirections(['a', 'b', 'c', 'd'], 'TD', additive({ a: 1.5, b: 0.8, c: 1.3, d: 1 }));
    expect([...result!.assignment.keys()].sort()).toEqual(['a', 'c']);
    expect(result!.assignment.get('a')).toBe('TD');
    expect(result!.fit).toBeGreaterThan(result!.baseFit * MIN_MIX_GAIN);
  });

  it('keeps a mix only if it beats the single direction clearly (each flip helps, together they gain under 15%)', () => {
    expect(searchGroupDirections(['a', 'b', 'c'], 'TD', additive({ a: 1.06, b: 1.05, c: 1.03 }))).toBeUndefined();
  });

  it('does nothing for a diagram that already fits (nothing to gain)', () => {
    expect(searchGroupDirections(['a', 'b', 'c'], 'TD', () => 1)).toBeUndefined();
  });

  it('has nothing to mix with fewer than two groups', () => {
    expect(searchGroupDirections(['a'], 'TD', additive({ a: 3 }))).toBeUndefined();
    expect(searchGroupDirections([], 'LR', () => 1)).toBeUndefined();
  });

  it('takes a second look at a group whose flip only pays off after another', () => {
    // b helps only once a has flipped (the score reads the whole assignment).
    const fitOf = (assignment: ReadonlyMap<string, FlowDirection>) => {
      const a = assignment.has('a'), b = assignment.has('b');
      return 0.25 * (a ? 1.5 : 1) * (b ? (a ? 1.5 : 0.9) : 1);
    };
    const result = searchGroupDirections(['b', 'a'], 'TD', fitOf);
    expect([...result!.assignment.keys()].sort()).toEqual(['a', 'b']);
  });

  it('tries at most ten groups and is deterministic', () => {
    const many = Array.from({ length: 14 }, (_, i) => `g${i}`);
    let calls = 0;
    const run = () => searchGroupDirections(many, 'LR', assignment => { calls++; return 0.2 * Math.pow(1.3, assignment.size); });
    const first = run();
    expect([...first!.assignment.keys()].every(group => Number(group.slice(1)) < 10)).toBe(true);
    expect(calls).toBeLessThan(40);
    const second = run();
    expect([...second!.assignment.keys()]).toEqual([...first!.assignment.keys()]);
  });
});
