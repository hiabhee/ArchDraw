import type { ShapePrimitive } from './types';

export interface RenderSurface {
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Per-surface rough fill style override (e.g. groups use solid, not cross-hatch). */
  fillStyle?: ShapePrimitive['fillStyle'];
}

/**
 * Apply a node surface (fill / stroke / strokeWidth) onto style-agnostic shape
 * primitives. `strokeOnly` details get `fill="none"`; `fillAsStroke` notches
 * (stand bars, speaker slots) fill with the surface stroke color.
 */
export function applyShapeSurface(primitives: ShapePrimitive[], surface: RenderSurface): ShapePrimitive[] {
  return primitives.map((p) => {
    const next: ShapePrimitive = { ...p };
    if (p.strokeOnly) {
      next.fill = 'none';
    } else if (p.fillAsStroke) {
      next.fill = surface.stroke;
    } else if (p.fillable) {
      next.fill = surface.fill;
    } else if (p.fill === undefined && p.kind === 'line') {
      next.fill = 'none';
    }
    if (surface.fillStyle) next.fillStyle = surface.fillStyle;
    if (next.stroke === undefined) next.stroke = surface.stroke;
    if (next.strokeWidth === undefined) next.strokeWidth = surface.strokeWidth;
    return next;
  });
}
