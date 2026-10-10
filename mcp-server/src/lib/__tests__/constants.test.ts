import { describe, it, expect } from 'vitest';
import {
  TIER_ORDER,
  TIER_RANK,
  TIER_COLORS,
  COMM_COLORS,
  DEFAULT_NODE_WIDTH,
  isTier,
} from '../constants.js';

describe('TIER_ORDER', () => {
  it('places client first and external after data', () => {
    expect(TIER_ORDER[0]).toBe('client');
    expect(TIER_ORDER.indexOf('data')).toBeGreaterThan(TIER_ORDER.indexOf('compute'));
    expect(TIER_ORDER.indexOf('external')).toBeGreaterThan(TIER_ORDER.indexOf('data'));
  });
});

describe('TIER_RANK', () => {
  it('assigns monotonic ranks matching left-to-right flow', () => {
    expect(TIER_RANK.client).toBe(0);
    expect(TIER_RANK.edge).toBe(1);
    expect(TIER_RANK.compute).toBe(2);
    expect(TIER_RANK.async).toBe(3);
    expect(TIER_RANK.data).toBe(4);
    expect(TIER_RANK.external).toBe(5);
  });
});

describe('TIER_COLORS', () => {
  it('provides a color for every tier', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_COLORS[tier]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('COMM_COLORS', () => {
  it('animates async/stream/event but not sync/dep', () => {
    expect(COMM_COLORS.async.animated).toBe(true);
    expect(COMM_COLORS.stream.animated).toBe(true);
    expect(COMM_COLORS.event.animated).toBe(true);
    expect(COMM_COLORS.sync.animated).toBe(false);
    expect(COMM_COLORS.dep.animated).toBe(false);
  });

  it('keeps the default node size constants', () => {
    expect(DEFAULT_NODE_WIDTH).toBe(200);
  });
});

describe('isTier', () => {
  it('validates known tiers and rejects junk', () => {
    expect(isTier('compute')).toBe(true);
    expect(isTier('COMPUTE')).toBe(true);
    expect(isTier('bogus')).toBe(false);
    expect(isTier(undefined)).toBe(false);
  });
});
