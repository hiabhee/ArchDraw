import { applyShapeSurface, type RenderSurface } from './applySurface';
import { sketchFillForShape, sketchHatchInk } from './sketch';
import { getStrokeRenderer } from './strokeRenderer';
import type { ShapePrimitive } from './types';

/**
 * Rough.js draws cross-hatch lines using the `fill` color as ink. When fill
 * matches the paper tint, the grid vanishes into the canvas. This renders a
 * solid paper base plus a contrasting hatch overlay.
 */
export function renderSketchBodyMarkup(
  primitives: ShapePrimitive[],
  surface: RenderSurface,
  seed: number,
  isDark: boolean,
  shape?: string | null,
): string {
  const renderer = getStrokeRenderer('rough');

  const paperMarkup = applyShapeSurface(primitives, { ...surface, fillStyle: 'solid' })
    .map((p) => renderer.renderPrimitive(p, seed))
    .join('\n');

  const fillStyle = sketchFillForShape(shape);

  if (fillStyle === 'solid') {
    return paperMarkup;
  }

  const hatchSeed = (seed * 31 + 7) >>> 0 || 1;
  const hatchMarkup = applyShapeSurface(primitives, {
    fill: sketchHatchInk(isDark),
    stroke: 'none',
    strokeWidth: 0,
    fillStyle,
  })
    .map((p) => renderer.renderPrimitive(p, hatchSeed))
    .join('\n');

  return paperMarkup + hatchMarkup;
}
