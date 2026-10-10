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

  // Respect an explicit fillStyle from the caller (e.g. GroupNode hachure)
  const explicit = (surface as { fillStyle?: string }).fillStyle as
    | 'solid'
    | 'hachure'
    | 'cross-hatch'
    | 'zigzag'
    | undefined;
  const fillStyle = explicit ?? sketchFillForShape(shape);

  // Solid shapes: single paper base with wobbly outline
  if (fillStyle === 'solid') {
    const paperMarkup = applyShapeSurface(primitives, { ...surface, fillStyle: 'solid' })
      .map((p) => renderer.renderPrimitive(p, seed))
      .join('\n');
    return paperMarkup;
  }

  // Cross-hatch / hachure: paper base + contrasting hatch overlay.
  // The paper base shows the warm tint; the hatch uses graphite/chalk ink.
  const paperMarkup = applyShapeSurface(primitives, { ...surface, fillStyle: 'solid' })
    .map((p) => renderer.renderPrimitive(p, seed))
    .join('\n');

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
