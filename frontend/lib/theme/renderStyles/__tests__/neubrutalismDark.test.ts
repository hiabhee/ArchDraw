import { describe, expect, it } from 'vitest';
import { getBrutalNodeFill, BRUTAL_NODE_INK_DARK, BRUTAL_NODE_INK_SOFT_DARK } from '../neubrutalism';
import { resolveCanvasTokens } from '../index';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('dark neubrutalism', () => {
  // The concern colours the canvas actually uses for its cards (client, compute, data, async, external), in every colour theme.
  const accents = ['default', 'studio-minimal', 'slate'].flatMap((colorThemeId) =>
    Object.values(resolveCanvasTokens({ renderStyleId: 'neubrutalism', colorThemeId, isDark: true }).concerns).map((swatch) => swatch.color).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)),
  );

  it('paints cards as deep jewel tones with light ink that stays readable', () => {
    for (const accent of accents) {
      const fill = getBrutalNodeFill(accent, true);
      // Dark, not bright, with light text well above the readable-text bar.
      expect(luminance(fill), accent).toBeLessThan(0.1);
      expect(contrast(fill, BRUTAL_NODE_INK_DARK), accent).toBeGreaterThanOrEqual(7);
      expect(contrast(fill, BRUTAL_NODE_INK_SOFT_DARK), accent).toBeGreaterThanOrEqual(5.5);
    }
  });

  it('keeps light mode a light but colourful block with near-black text', () => {
    const fill = getBrutalNodeFill('#3b82f6', false);
    expect(luminance(fill)).toBeGreaterThan(0.5);
    expect(fill).not.toBe('#ffffff');
    expect(contrast(fill, '#1a1a1a')).toBeGreaterThanOrEqual(9);
  });

  it('is rich, not grey: every coloured concern keeps a clear saturation', () => {
    const saturation = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      return max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1));
    };
    // A neutral (grey) concern stays grey on purpose; every coloured one becomes vivid.
    for (const accent of accents.filter((c) => saturation(c) > 0.2)) expect(saturation(getBrutalNodeFill(accent, true)), accent).toBeGreaterThan(0.4);
  });

  it('hands the canvas a separate ink for card text', () => {
    const dark = resolveCanvasTokens({ renderStyleId: 'neubrutalism', colorThemeId: 'default', isDark: true }).cssVars;
    expect(dark['--arch-node-ink']).toBe(BRUTAL_NODE_INK_DARK);
    // Text on the canvas, groups and labels is light too.
    expect(luminance(dark['--arch-title'])).toBeGreaterThan(0.8);
  });
});
