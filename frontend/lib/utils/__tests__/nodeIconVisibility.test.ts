import { describe, expect, it } from 'vitest';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';

describe('resolveNodeIconVisibility', () => {
  it('shows all icons in "all" mode', () => {
    expect(resolveNodeIconVisibility('all')).toBe(true);
    expect(resolveNodeIconVisibility('all', undefined, true)).toBe(true);
  });

  it('hides every icon in "off" mode', () => {
    expect(resolveNodeIconVisibility('off')).toBe(false);
    expect(resolveNodeIconVisibility('off', undefined, false)).toBe(false);
  });

  it('hides only manual (Properties-panel) icons in "normal" mode', () => {
    expect(resolveNodeIconVisibility('normal', undefined, true)).toBe(false);
    expect(resolveNodeIconVisibility('normal', undefined, false)).toBe(true);
    expect(resolveNodeIconVisibility('normal')).toBe(true);
  });

  it('lets per-node showIcon override the global mode', () => {
    expect(resolveNodeIconVisibility('off', true)).toBe(true);
    expect(resolveNodeIconVisibility('all', false)).toBe(false);
    expect(resolveNodeIconVisibility('normal', true, true)).toBe(true);
    expect(resolveNodeIconVisibility('normal', false, false)).toBe(false);
  });
});
