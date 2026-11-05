import { describe, expect, it } from 'vitest';
import { maxProjectsFor, planFromSubscription, PRO_MAX_PROJECTS } from '../plans';

const now = Date.parse('2026-11-01T00:00:00Z');

describe('planFromSubscription', () => {
  it('is free with no subscription', () => {
    expect(planFromSubscription(null, now)).toBe('free');
    expect(planFromSubscription(undefined, now)).toBe('free');
  });
  it('is pro while trialing, active or in the past_due grace period', () => {
    for (const status of ['on_trial', 'active', 'past_due']) expect(planFromSubscription({ status }, now)).toBe('pro');
  });
  it('keeps a cancelled subscription pro until the paid period ends', () => {
    expect(planFromSubscription({ status: 'cancelled', endsAt: '2026-11-15T00:00:00Z' }, now)).toBe('pro');
    expect(planFromSubscription({ status: 'cancelled', endsAt: '2026-10-15T00:00:00Z' }, now)).toBe('free');
    expect(planFromSubscription({ status: 'cancelled', endsAt: null }, now)).toBe('free');
  });
  it('is free once expired, unpaid or paused', () => {
    for (const status of ['expired', 'unpaid', 'paused', 'nonsense']) expect(planFromSubscription({ status }, now)).toBe('free');
  });
});

describe('maxProjectsFor', () => {
  it('raises the cap for pro and never lowers it', () => {
    expect(maxProjectsFor(2, 'free')).toBe(2);
    expect(maxProjectsFor(2, 'pro')).toBe(PRO_MAX_PROJECTS);
    expect(maxProjectsFor(50, 'pro')).toBe(50);
  });
});
