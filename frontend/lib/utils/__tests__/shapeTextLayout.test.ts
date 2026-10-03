import { describe, expect, it } from 'vitest';
import {
  diamondClipPath,
  getDiamondLabelNudge,
  getShapeLabelMaxWidth,
  shouldStackLabelVertically,
} from '@/lib/utils/shapeTextLayout';

describe('shapeTextLayout', () => {
  it('returns a tighter band for diamond subtitles than titles', () => {
    expect(getShapeLabelMaxWidth('diamond', 200, 'subtitle')).toBeLessThan(
      getShapeLabelMaxWidth('diamond', 200, 'title'),
    );
  });

  it('nudges diamond labels upward when icon and sublabel are present', () => {
    expect(getDiamondLabelNudge('diamond', true, true)).toBeLessThan(0);
    expect(getDiamondLabelNudge('rectangle', true, true)).toBe(0);
  });

  it('builds a diamond clip path polygon', () => {
    expect(diamondClipPath(200, 96)).toContain('polygon(');
    expect(diamondClipPath(200, 96)).toContain('100px');
  });
  it('resolves correct max widths for new architecture-native shapes', () => {
    const newShapes = ['queue', 'cache', 'function', 'container', 'bucket'];
    for (const shape of newShapes) {
      const width = 200;
      const titleWidth = getShapeLabelMaxWidth(shape, width, 'title');
      const subtitleWidth = getShapeLabelMaxWidth(shape, width, 'subtitle');
      expect(titleWidth).toBeGreaterThan(56);
      expect(subtitleWidth).toBeLessThan(titleWidth);
    }
  });

  it('stacks icon-over-title when a row would squeeze the title mid-word', () => {
    // 160px cloud: 0.8 band (128) minus icon (~48) leaves <96px — "Payment"
    // would break mid-word, so stack vertically for the full band width.
    expect(shouldStackLabelVertically(128, 48)).toBe(true);
    // Wide rectangle row keeps the compact horizontal layout.
    expect(shouldStackLabelVertically(176, 40)).toBe(false);
  });
});
