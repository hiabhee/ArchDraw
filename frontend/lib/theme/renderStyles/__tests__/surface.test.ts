import { describe, it, expect } from 'vitest';
import { resolveRenderSurface } from '../surface';
import { LIGHT_NODE_STYLES, DARK_NODE_STYLES } from '@/lib/theme/stylingConstants';
import {
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_PAPER_DARK_BORDER,
  SKETCH_INK_LIGHT_BORDER,
} from '../sketch';

describe('resolveRenderSurface', () => {
  it('resolves precision styles correctly on light mode', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'precision',
      isDark: false,
      selected: false,
      accentColor: '#0f766e',
    });
    expect(res.fill).toBe('#ffffff');
    expect(res.stroke).toBe('rgba(15, 23, 42, 0.14)');
    expect(res.strokeWidth).toBe(1.25);
    expect(res.boxShadow).toBe(LIGHT_NODE_STYLES.shadow);
  });

  it('resolves precision styles correctly on dark mode', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'precision',
      isDark: true,
      selected: false,
      accentColor: '#0f766e',
    });
    expect(res.fill).toBe(DARK_NODE_STYLES.background);
    expect(res.stroke).toBe('rgba(255, 255, 255, 0.12)');
    expect(res.strokeWidth).toBe(1.25);
  });

  it('resolves sketch styles with paper tint on light mode', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'sketch',
      isDark: false,
      selected: false,
      accentColor: '#0f766e',
    });
    expect(res.fill).toBe(SKETCH_PAPER_TINT);
    expect(res.stroke).toBe(SKETCH_INK_LIGHT_BORDER);
    expect(res.boxShadow).toBe('none');
    expect(res.strokeWidth).toBeCloseTo(1.35);
  });

  it('resolves sketch styles with chalkboard dark paper on dark mode', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'sketch',
      isDark: true,
      selected: false,
      accentColor: '#0f766e',
    });
    expect(res.fill).toBe(SKETCH_PAPER_DARK);
    expect(res.stroke).toBe(SKETCH_PAPER_DARK_BORDER);
    expect(res.boxShadow).toBe('none');
  });

  it('handles selected states correctly', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'precision',
      isDark: false,
      selected: true,
      accentColor: '#0f766e',
    });
    expect(res.stroke).toBe('#0f766e');
    expect(res.strokeWidth).toBe(2);
    expect(res.boxShadow).toBe(LIGHT_NODE_STYLES.shadowSelected);
  });

  it('boosts sketch selected stroke slightly for ink visibility', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'sketch',
      isDark: false,
      selected: true,
      accentColor: '#0f766e',
    });
    // Sketch selection is muted penciled accent, not full saturated ring
    expect(res.stroke).toBe('rgba(15, 118, 110, 0.44)');
    expect(res.strokeWidth).toBeCloseTo(2.0);
    expect(res.boxShadow).toBe('none');
  });
});
