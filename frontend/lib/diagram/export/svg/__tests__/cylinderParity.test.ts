import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { generatePureSVG } from '../index';
import { horizontalPipeGeometry, verticalDrumGeometry } from '@/lib/theme/shapeGeometry';

// Export snaps nodes to the sizing grid; use the sizes it produces.
const cylinder = (data: Record<string, unknown>, width = 160, height = 100) =>
  [{ id: 'db', type: 'shapeNode', position: { x: 0, y: 0 }, width, height, data: { label: 'DB', shape: 'cylinder', ...data } }] as Node[];

describe('SVG export cylinders match canvas geometry', () => {
  it('draws the vertical drum rims and outline from the shared geometry', () => {
    const svg = generatePureSVG(cylinder({}), [], false, '#fff', 'LR', 'precision');
    const g = verticalDrumGeometry(160, 100);
    expect(svg).toContain(g.backRim);
    expect(svg).toContain(g.frontRim);
    expect(svg).toContain(g.silhouette);
  });

  it('draws the horizontal pipe from the shared geometry', () => {
    const svg = generatePureSVG(cylinder({ cylinderAxis: 'horizontal' }, 240, 100), [], false, '#fff', 'LR', 'precision');
    const g = horizontalPipeGeometry(240, 100);
    expect(svg).toContain(g.backRim);
    expect(svg).toContain(g.silhouette);
  });
});
