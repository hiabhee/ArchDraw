import { describe, expect, it } from 'vitest';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { SKETCH_HATCH_INK_DARK, SKETCH_HATCH_INK_LIGHT, SKETCH_PAPER_TINT } from '../sketch';
import { renderSketchBodyMarkup } from '../sketchBody';

describe('renderSketchBodyMarkup', () => {
  it('renders a solid paper body with no cross-hatch ink', () => {
    const markup = renderSketchBodyMarkup(
      getShapePrimitives('rounded-rectangle', 200, 96),
      {
        fill: SKETCH_PAPER_TINT,
        stroke: 'rgba(15, 23, 42, 0.55)',
        strokeWidth: 1.75,
      },
      42,
      false,
      'rounded-rectangle',
    );

    // sketchFillForShape is solid everywhere now, so the body is just the
    // paper underlay + wobbly outline — the hatch overlay is never emitted.
    expect(markup).toContain(`fill="${SKETCH_PAPER_TINT}"`);
    expect(markup).not.toContain(SKETCH_HATCH_INK_LIGHT);
    expect(markup).toContain('<path');
  });

  it('renders solid fill for groups (no hatch) per design improvements', () => {
    const markup = renderSketchBodyMarkup(
      getShapePrimitives('diamond', 160, 88),
      {
        fill: '#3a332c',
        stroke: 'rgba(250, 248, 245, 0.55)',
        strokeWidth: 1.75,
      },
      11,
      true,
      'group',
    );

    // Groups should have solid fill (no hatch texture) to stay quiet
    expect(markup).toContain('fill="#3a332c"');
    // Should NOT contain hatch ink since groups use solid fill
    expect(markup).not.toContain(SKETCH_HATCH_INK_DARK);
  });
});
