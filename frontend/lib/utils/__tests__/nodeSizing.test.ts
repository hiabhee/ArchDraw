import { describe, expect, it } from 'vitest';
import {
  calculateNodeDimensions,
  fitWidthToContent,
  SIZE_L,
  SIZE_M,
  SIZE_S,
  SIZE_XS,
} from '@/lib/utils/nodeSizing';
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

  it('grows horizontal pipe height for 2nd and 3rd label lines', () => {
    const single = calculateNodeDimensions('Kafka Topic', undefined, {
      shape: 'cylinder',
      cylinderAxis: 'horizontal',
    });
    const twoLines = calculateNodeDimensions('Kafka', 'Topic', {
      shape: 'cylinder',
      cylinderAxis: 'horizontal',
    });
    const threeLines = calculateNodeDimensions('Line one\nLine two\nLine three', undefined, {
      shape: 'cylinder',
      cylinderAxis: 'horizontal',
    });

    expect(single.height).toBe(40);
    expect(twoLines.height).toBe(52);
    expect(threeLines.height).toBe(58);
    expect(twoLines.height).toBeGreaterThan(single.height);
    expect(threeLines.height).toBeGreaterThan(twoLines.height);
  });
});

describe('semantic silhouette sizing', () => {
  const bands: Record<string, { wMin: number; wMax: number; hMin: number; hMax: number }> = {
    hexagon: { wMin: SIZE_S, wMax: 200, hMin: 88, hMax: 96 },
    cloud: { wMin: 200, wMax: SIZE_L, hMin: 96, hMax: 112 },
    actor: { wMin: SIZE_XS, wMax: SIZE_S, hMin: 88, hMax: 100 },
    monitor: { wMin: 200, wMax: SIZE_L, hMin: 100, hMax: 120 },
    mobile: { wMin: SIZE_XS, wMax: SIZE_S, hMin: 100, hMax: 130 },
    'dashed-rectangle': { wMin: SIZE_S, wMax: SIZE_L, hMin: 88, hMax: 112 },
    // New architecture-native shapes
    queue: { wMin: SIZE_M, wMax: SIZE_L, hMin: 56, hMax: 72 },
    cache: { wMin: SIZE_S, wMax: SIZE_M, hMin: 88, hMax: 104 },
    function: { wMin: SIZE_S, wMax: SIZE_M, hMin: 88, hMax: 104 },
    container: { wMin: SIZE_M, wMax: SIZE_L, hMin: 96, hMax: 120 },
    bucket: { wMin: SIZE_S, wMax: SIZE_M, hMin: 96, hMax: 112 },
  };

  for (const [shape, band] of Object.entries(bands)) {
    it(`keeps ${shape} within its width band (${band.wMin}–${band.wMax})`, () => {
      const dims = calculateNodeDimensions('Semantic Load Balancer', undefined, { shape });
      expect(dims.width).toBeGreaterThanOrEqual(band.wMin);
      expect(dims.width).toBeLessThanOrEqual(band.wMax);
    });

    it(`keeps ${shape} within its height band (${band.hMin}–${band.hMax})`, () => {
      const dims = calculateNodeDimensions('Semantic Load Balancer', undefined, { shape });
      expect(dims.height).toBeGreaterThanOrEqual(band.hMin);
      expect(dims.height).toBeLessThanOrEqual(band.hMax);
    });
  }

  it('hexagon stays under the shared lane cap like diamond', () => {
    const hex = calculateNodeDimensions('API Gateway', undefined, { shape: 'hexagon' });
    const diamond = calculateNodeDimensions('API Gateway', undefined, { shape: 'diamond' });
    expect(hex.height).toBeLessThanOrEqual(SHAPE_LANE_HEIGHT_CAP);
    expect(Math.abs(hex.height - diamond.height)).toBeLessThanOrEqual(24);
  });

  it('actor and mobile use the compact size tier', () => {
    const actor = calculateNodeDimensions('Alice', undefined, { shape: 'actor' });
    const mobile = calculateNodeDimensions('Mobile App', undefined, { shape: 'mobile' });
    expect(actor.width).toBeLessThanOrEqual(SIZE_S);
    expect(mobile.width).toBeLessThanOrEqual(SIZE_S);
    expect(actor.width).toBeGreaterThanOrEqual(SIZE_XS);
    expect(mobile.width).toBeGreaterThanOrEqual(SIZE_XS);
  });

  it('fitWidthToContent supports the extra-small tier', () => {
    expect(fitWidthToContent(110, SIZE_XS, SIZE_S)).toBe(SIZE_XS);
    expect(fitWidthToContent(140, SIZE_XS, SIZE_S)).toBe(SIZE_S);
  });
});
