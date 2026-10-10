import { describe, expect, it } from 'vitest';
import { formatSubsystemSummariesForPrompt } from './repo-prompt-utils';
import { nextKeyFileCount } from './repo-component-extractor';

describe('formatSubsystemSummariesForPrompt', () => {
  it('caps a large summary list without discarding all context', () => {
    const result = formatSubsystemSummariesForPrompt(['first', 'x'.repeat(100)], 20);

    expect(result).toContain('first');
    expect(result.length).toBeLessThanOrEqual(20 + '\n... [subsystem summaries truncated]'.length);
    expect(result).toContain('truncated');
  });

  it('returns an empty string when no summaries are available', () => {
    expect(formatSubsystemSummariesForPrompt([], 100)).toBe('');
  });
});

describe('nextKeyFileCount', () => {
  it('always shrinks a multi-file source set', () => {
    expect(nextKeyFileCount(3)).toBe(2);
    expect(nextKeyFileCount(2)).toBe(1);
    expect(nextKeyFileCount(1)).toBe(1);
  });
});
