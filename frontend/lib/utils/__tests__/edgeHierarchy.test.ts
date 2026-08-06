import { describe, it, expect } from 'vitest';
import { isPrimaryEdge, resolveEdgeVisual } from '../edgeHierarchy';

describe('isPrimaryEdge', () => {
  it('treats unclassified legacy edges as primary', () => {
    expect(isPrimaryEdge(undefined)).toBe(true);
    expect(isPrimaryEdge({})).toBe(true);
  });

  it('marks spine / primary / thick as primary', () => {
    expect(isPrimaryEdge({ isSpine: true })).toBe(true);
    expect(isPrimaryEdge({ importance: 'primary' })).toBe(true);
    expect(isPrimaryEdge({ edgeVariant: 'thick' })).toBe(true);
  });

  it('demotes secondary and supporting edges', () => {
    expect(isPrimaryEdge({ importance: 'secondary' })).toBe(false);
    expect(isPrimaryEdge({ importance: 'supporting' })).toBe(false);
    expect(isPrimaryEdge({ isSpine: false })).toBe(false);
  });
});

describe('resolveEdgeVisual', () => {
  it('gives primary spine high contrast and thicker stroke', () => {
    const v = resolveEdgeVisual({ importance: 'primary', isSpine: true }, false);
    expect(v.isPrimary).toBe(true);
    expect(v.opacity).toBe(1);
    expect(v.strokeWidth).toBeGreaterThanOrEqual(1.75);
    expect(v.stroke).toBe('#0f172a');
  });

  it('mutes secondary sync edges', () => {
    const v = resolveEdgeVisual({ importance: 'secondary' }, false);
    expect(v.isPrimary).toBe(false);
    expect(v.opacity).toBeGreaterThanOrEqual(0.85);
    expect(v.stroke).toBe('#64748b');
  });

  it('styles async edges with amber', () => {
    const v = resolveEdgeVisual({ connectionType: 'async' }, false);
    expect(v.isPrimary).toBe(false);
    expect(v.stroke.toLowerCase()).toMatch(/#c2410c|#b45309/);
  });

  it('keeps diagnostic edges quieter but visible', () => {
    const v = resolveEdgeVisual({ importance: 'diagnostic', portType: 'observability' }, false);
    expect(v.isPrimary).toBe(false);
    expect(v.opacity).toBeGreaterThanOrEqual(0.7);
    expect(v.opacity).toBeLessThan(1);
  });
});
