import { describe, expect, it } from 'vitest';
import {
  genericTeachingFallback,
  resolveComponentTooltip,
} from '@/lib/tutorial/componentTooltipResolver';

describe('componentTooltipResolver', () => {
  it('resolves aliases like Web Client → Web', () => {
    const result = resolveComponentTooltip('Web Client');
    expect(result.whyItMatters).toBeTruthy();
    expect(result.tradeoff).toBeTruthy();
  });

  it('falls back to generic pedagogy for unknown components', () => {
    const fallback = genericTeachingFallback('Mystery Box');
    expect(fallback.whyItMatters).toContain('Mystery Box');
    expect(fallback.tradeoff).toContain('Mystery Box');

    const resolved = resolveComponentTooltip('Mystery Box');
    expect(resolved.whyItMatters).toBe(fallback.whyItMatters);
    expect(resolved.tradeoff).toBe(fallback.tradeoff);
  });
});
