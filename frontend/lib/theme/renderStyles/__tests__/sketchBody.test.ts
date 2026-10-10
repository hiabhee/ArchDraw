import { describe, expect, it } from 'vitest';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { SKETCH_HATCH_INK_DARK, SKETCH_HATCH_INK_LIGHT, SKETCH_PAPER_TINT } from '../sketch';
import { renderSketchBodyMarkup } from '../sketchBody';

describe('renderSketchBodyMarkup', () => {
  it('renders solid paper with wobbly outline on board-like shapes (no hatch)', () => {
    const markup = renderSketchBodyMarkup(
      getShapePrimitives('rounded-rectangle', 200, 96),
      {
        fill: SKETCH_PAPER_TINT,
        stroke: 'rgba(28, 25, 23, 0.62)',
        strokeWidth: 1.95,
      },
      42,
      false,
      'rounded-rectangle',
    );

    // Board-like shapes are now solid paper + wobbly outline — clean, not textured
    expect(markup).toContain(`fill="${SKETCH_PAPER_TINT}"`);
    expect(markup).not.toContain(SKETCH_HATCH_INK_LIGHT);
    expect(markup).toContain('<path');
  });

  it('renders hachure for groups and solid for small glyphs', () => {
    const groupMarkup = renderSketchBodyMarkup(
      getShapePrimitives('rounded-rectangle', 160, 88),
      {
        fill: '#3a332c',
        stroke: 'rgba(250, 248, 245, 0.55)',
        strokeWidth: 1.75,
        fillStyle: 'hachure',
      },
      11,
      true,
      'group',
    );
    // Groups use hachure swimlane — hatch ink present
    expect(groupMarkup).toContain('fill="#3a332c"');
    expect(groupMarkup).toContain(SKETCH_HATCH_INK_DARK);

    const diamondMarkup = renderSketchBodyMarkup(
      getShapePrimitives('diamond', 160, 88),
      {
        fill: SKETCH_PAPER_TINT,
        stroke: 'rgba(28, 25, 23, 0.62)',
        strokeWidth: 1.95,
      },
      42,
      false,
      'diamond',
    );
    // Small glyphs stay solid — no hatch overlay
    expect(diamondMarkup).toContain(`fill="${SKETCH_PAPER_TINT}"`);
    expect(diamondMarkup).not.toContain(SKETCH_HATCH_INK_LIGHT);
  });
});
