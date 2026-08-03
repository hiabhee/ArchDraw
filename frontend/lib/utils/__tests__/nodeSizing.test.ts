import { describe, expect, it } from 'vitest';
import { calculateNodeDimensions, fitWidthToContent, SIZE_L, SIZE_M, SIZE_S } from '@/lib/utils/nodeSizing';
import { SHAPE_LANE_HEIGHT_CAP } from '@/lib/theme/stylingConstants';

describe('calculateNodeDimensions', () => {
  it('uses default medium width for short labels', () => {
    const dims = calculateNodeDimensions('API', undefined, { shape: 'rounded-rectangle' });
    expect(dims.width).toBe(SIZE_M);
    expect(dims.height).toBeGreaterThanOrEqual(80);
  });

  it('stays on the optical grid for long rectangle labels (wraps instead of growing past L)', () => {
    const dims = calculateNodeDimensions('Load Balancer Entry Point Service Gateway', undefined, {
      shape: 'rounded-rectangle',
    });
    expect(dims.width).toBeLessThanOrEqual(SIZE_L);
    expect(dims.height).toBeGreaterThan(80);
  });

  it('keeps diamonds compact on the grid for mid-length labels', () => {
    const label = 'Load Balancer Entry Point';
    const diamond = calculateNodeDimensions(label, undefined, { shape: 'diamond' });
    expect(diamond.width).toBeLessThanOrEqual(SIZE_L);
    expect(diamond.width).toBeGreaterThanOrEqual(SIZE_S);
    expect(diamond.height).toBeLessThanOrEqual(SHAPE_LANE_HEIGHT_CAP);
    expect(diamond.height).toBeGreaterThanOrEqual(80);
  });

  it('caps diamonds at the lane height so they stay level with rectangles', () => {
    const label = 'Load Balancer Entry Point';
    const rect = calculateNodeDimensions(label, undefined, { shape: 'rounded-rectangle' });
    const diamond = calculateNodeDimensions(label, undefined, { shape: 'diamond' });
    // Diamond must not tower over the adjacent rectangle in the same lane.
    expect(diamond.height).toBeLessThanOrEqual(SHAPE_LANE_HEIGHT_CAP);
    expect(diamond.height - rect.height).toBeLessThanOrEqual(24);
  });

  it('sizes diamonds from the mid-band without a large bbox boost over rectangles', () => {
    const label = 'Load Balancer Entry Point';
    const rect = calculateNodeDimensions(label, undefined, { shape: 'rounded-rectangle' });
    const diamond = calculateNodeDimensions(label, undefined, { shape: 'diamond' });
    // Same grid cap; diamond may be same width or one step larger, never near 2×.
    expect(diamond.width).toBeLessThanOrEqual(SIZE_L);
    expect(diamond.width).toBeLessThanOrEqual(rect.width + 40);
  });

  it('fitWidthToContent snaps small sizes to the grid and respects max', () => {
    expect(fitWidthToContent(190)).toBe(SIZE_M);
    expect(fitWidthToContent(230)).toBe(SIZE_L);
    expect(fitWidthToContent(300, SIZE_S, SIZE_L)).toBe(SIZE_L);
    expect(fitWidthToContent(300, SIZE_S, 320)).toBe(320);
  });
});
