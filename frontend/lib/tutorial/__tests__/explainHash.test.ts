import { describe, expect, it } from 'vitest';
import { buildExplainCacheHash } from '@/lib/tutorial/explainHash';

describe('buildExplainCacheHash', () => {
  it('is stable for the same inputs', () => {
    const a = buildExplainCacheHash('url-shortener-architecture', 'step-1', 'intro', 0);
    const b = buildExplainCacheHash('url-shortener-architecture', 'step-1', 'intro', 0);
    expect(a).toBe(b);
  });

  it('changes when variant index changes', () => {
    const a = buildExplainCacheHash('url-shortener-architecture', 'step-1', 'intro', 0);
    const b = buildExplainCacheHash('url-shortener-architecture', 'step-1', 'intro', 1);
    expect(a).not.toBe(b);
  });
});
