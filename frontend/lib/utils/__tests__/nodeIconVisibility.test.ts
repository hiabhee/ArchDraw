import { describe, expect, it } from 'vitest';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';

describe('resolveNodeIconVisibility', () => {
  it('follows the global preference when the node has no override', () => {
    expect(resolveNodeIconVisibility(true)).toBe(true);
    expect(resolveNodeIconVisibility(false)).toBe(false);
  });

  it('lets per-node showIcon override the global preference', () => {
    expect(resolveNodeIconVisibility(true, false)).toBe(false);
    expect(resolveNodeIconVisibility(false, true)).toBe(true);
  });
});
