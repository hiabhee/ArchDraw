import { describe, expect, it } from 'vitest';
import { semanticShapeBodySvg } from '@/lib/utils/shapeSilhouetteSvg';

const surface = { fill: '#fff', stroke: '#000', strokeWidth: 1.5 };

describe('semanticShapeBodySvg', () => {
  const shapes = ['hexagon', 'cloud', 'actor', 'monitor', 'mobile', 'dashed-rectangle', 'queue', 'cache', 'function', 'container', 'bucket'] as const;

  it.each(shapes)('renders a distinct SVG body for %s', (shape) => {
    const svg = semanticShapeBodySvg(shape, 200, 100, surface, false);
    expect(svg).toBeTruthy();
    expect(svg).toContain('fill=');
    expect(svg).toContain('stroke=');
  });

  it('returns null for basic shapes handled elsewhere', () => {
    expect(semanticShapeBodySvg('rounded-rectangle', 200, 100, surface)).toBeNull();
    expect(semanticShapeBodySvg('diamond', 200, 100, surface)).toBeNull();
  });

  it('uses a dashed stroke for dashed-rectangle', () => {
    const svg = semanticShapeBodySvg('dashed-rectangle', 200, 100, surface, false)!;
    expect(svg).toContain('stroke-dasharray');
  });

  it('renders hexagon with six vertices', () => {
    const svg = semanticShapeBodySvg('hexagon', 200, 96, surface)!;
    expect(svg).toContain('<polygon');
    expect(svg?.match(/,/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
