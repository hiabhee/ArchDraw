import { describe, expect, it } from 'vitest';
import { wrapperMatchesSize } from '../wrapperSize';

describe('wrapperMatchesSize', () => {
  it('matches when the wrapper is the size the card computed', () => {
    expect(wrapperMatchesSize({ width: 240, height: 99 }, 240, 99)).toBe(true);
  });

  it('absorbs React Flow\'s measured floats (within a pixel) so a re-sync cannot ping-pong', () => {
    expect(wrapperMatchesSize({ width: 240.4, height: 98.7 }, 240, 99)).toBe(true);
  });

  it('does not match a wrapper that still has the older size (a saved or reloaded node)', () => {
    expect(wrapperMatchesSize({ width: 192, height: 79 }, 240, 99)).toBe(false);
    expect(wrapperMatchesSize({ width: 240, height: 79 }, 240, 99)).toBe(false);
  });

  it('has nothing to correct while the wrapper size is not known yet', () => {
    expect(wrapperMatchesSize(undefined, 240, 99)).toBe(true);
    expect(wrapperMatchesSize({ width: undefined, height: 79 }, 240, 99)).toBe(true);
    expect(wrapperMatchesSize({ width: 192, height: null }, 240, 99)).toBe(true);
  });
});
