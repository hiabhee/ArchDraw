import { describe, expect, it } from 'vitest';
import { dataUrlBytes, fitWithin } from '../imageDownscale';

describe('imageDownscale', () => {
  it('shrinks the longest side to the limit and keeps the proportions', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 6000, 1600)).toEqual({ width: 267, height: 1600 });
  });

  it('never enlarges a small image', () => {
    expect(fitWithin(320, 200, 1600)).toEqual({ width: 320, height: 200 });
  });

  it('measures the bytes behind a base64 data URL', () => {
    expect(dataUrlBytes('data:image/png;base64,' + 'A'.repeat(400))).toBe(300);
  });
});
