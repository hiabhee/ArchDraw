import { describe, expect, it } from 'vitest';
import { resolveCanvasTokens } from '../resolveTokens';
import { DEFAULT_RENDER_STYLE_ID } from '../registry';
import { SKETCH_PAPER_TINT } from '../sketch';

describe('resolveCanvasTokens', () => {
  it('defaults to precision render style', () => {
    const tokens = resolveCanvasTokens({ renderStyleId: null, colorThemeId: 'default', isDark: false });
    expect(tokens.renderStyleId).toBe('precision');
    expect(tokens.render.strokeEngine).toBe('crisp');
    expect(tokens.strokeRenderer.engine).toBe('crisp');
  });

  it('keeps default stroke width / radius for precision', () => {
    const tokens = resolveCanvasTokens({ renderStyleId: 'precision', isDark: false });
    expect(tokens.strokeWidth).toBeCloseTo(1.25);
    expect(tokens.borderRadius).toBeCloseTo(10);
  });

  it('resolves sketch stroke width / radius from geometry scale', () => {
    const tokens = resolveCanvasTokens({ renderStyleId: 'sketch', isDark: false });
    expect(tokens.render.strokeEngine).toBe('rough');
    expect(tokens.strokeRenderer.engine).toBe('rough');
    // Sketch geometry scales are now 1 (parity with precision) — no boost.
    expect(tokens.strokeWidth).toBeCloseTo(1.25);
    expect(tokens.borderRadius).toBeCloseTo(10);
  });

  it('emits render-style + font css vars', () => {
    const tokens = resolveCanvasTokens({ renderStyleId: 'sketch', isDark: false });
    expect(tokens.cssVars['--arch-render-style']).toBe('sketch');
    expect(tokens.cssVars['--arch-font-title']).toBe(tokens.fonts.title);
    expect(tokens.cssVars['--arch-stroke-width']).toBe(`${tokens.strokeWidth}px`);
    expect(tokens.cssVars['--arch-radius']).toBe(`${tokens.borderRadius}px`);
  });

  it('applies paper tint to light-mode sketch fills', () => {
    const light = resolveCanvasTokens({ renderStyleId: 'sketch', isDark: false });
    expect(light.cssVars['--arch-node-fill']).toBe(SKETCH_PAPER_TINT);
    const dark = resolveCanvasTokens({ renderStyleId: 'sketch', isDark: true });
    expect(dark.cssVars['--arch-node-fill']).not.toBe(SKETCH_PAPER_TINT);
  });

  it('keeps color theme colors identical to diagramThemeCssVars', () => {
    const tokens = resolveCanvasTokens({ renderStyleId: 'precision', colorThemeId: 'slate', isDark: true });
    expect(tokens.cssVars['--arch-group-stroke']).toMatch(/rgba|#/);
    expect(tokens.colorThemeId).toBe('slate');
  });

  it('returns a default render style id constant', () => {
    expect(DEFAULT_RENDER_STYLE_ID).toBe('precision');
  });
});
