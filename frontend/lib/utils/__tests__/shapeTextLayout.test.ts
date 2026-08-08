import { describe, expect, it } from 'vitest';
import {
  diamondClipPath,
  getDiamondLabelNudge,
  getShapeLabelMaxWidth,
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
});
