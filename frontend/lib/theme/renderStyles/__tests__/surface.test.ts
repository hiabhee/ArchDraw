import { describe, it, expect } from 'vitest';
import { resolveRenderSurface } from '../surface';
import { LIGHT_NODE_STYLES, DARK_NODE_STYLES } from '@/lib/theme/stylingConstants';

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
    expect(res.fill).toBe('#ffffff'); // SKETCH_PAPER_TINT
    expect(res.stroke).toBe('rgba(15, 23, 42, 0.2)'); // SKETCH_INK_LIGHT_BORDER
    expect(res.boxShadow).toBe(LIGHT_NODE_STYLES.shadow);
  });

  it('resolves sketch styles with chalkboard dark paper on dark mode', () => {
    const res = resolveRenderSurface({
      renderStyleId: 'sketch',
      isDark: true,
      selected: false,
      accentColor: '#0f766e',
    });
    expect(res.fill).toBe('#1a1d27'); // SKETCH_PAPER_DARK
    expect(res.stroke).toBe('rgba(255, 255, 255, 0.18)'); // SKETCH_PAPER_DARK_BORDER
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
});
