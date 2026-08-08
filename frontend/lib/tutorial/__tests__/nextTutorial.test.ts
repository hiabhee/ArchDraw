import { describe, expect, it } from 'vitest';
import { getNextTutorial } from '@/lib/tutorial/nextTutorial';

describe('getNextTutorial', () => {
  it('follows recommendedOrder for beginner path tutorials', () => {
    const next = getNextTutorial('url-shortener-architecture');
    expect(next?.id).toBe('rate-limiter-architecture');
  });

  it('uses curated map when present', () => {
    const next = getNextTutorial('github-architecture');
    expect(next?.id).toBe('url-shortener-architecture');
  });

  it('returns null for unknown tutorial ids', () => {
    expect(getNextTutorial('not-a-real-tutorial')).toBeNull();
  });
});
