import {
  type DiagramRenderStyleId,
  type ShapePrimitive,
} from './types';
import {
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
  type NodeStyleConfig,
} from '@/lib/theme/stylingConstants';
import {
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_PAPER_DARK_BORDER,
  SKETCH_INK_LIGHT_BORDER,
} from './sketch';
import { renderSketchBodyMarkup } from './sketchBody';
import { getStrokeRenderer } from './strokeRenderer';

export interface ResolveRenderSurfaceInput {
  renderStyleId: DiagramRenderStyleId | string | null;
  isDark: boolean;
  selected?: boolean;
  accentColor?: string;
  nodeStyle?: NodeStyleConfig;
  shape?: string | null;
}

export interface RenderSurface {
  fill: string;
  stroke: string;
  strokeWidth: number;
  boxShadow?: string;
  dropShadow?: string;
  fillStyle?: ShapePrimitive['fillStyle'];
}

export function resolveRenderSurface(input: ResolveRenderSurfaceInput): RenderSurface {
  const sketch = input.renderStyleId === 'sketch';
  const styles = input.nodeStyle ?? (input.isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES);
  const selected = input.selected ?? false;
  const accentColor = input.accentColor ?? '#0f766e';

  // Sketch now uses precision colors — only a tiny rough.js wobble differs.
  const fill = sketch
    ? input.isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT
    : input.isDark ? styles.background : '#ffffff';
  const stroke = selected
    ? accentColor
    : sketch
      ? input.isDark ? SKETCH_PAPER_DARK_BORDER : SKETCH_INK_LIGHT_BORDER
      : input.isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(15, 23, 42, 0.14)';
  const strokeWidth = selected ? 2 : 1.25;
  const boxShadow = selected ? styles.shadowSelected : styles.shadow;
  const dropShadow = input.isDark
    ? selected
      ? 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))'
      : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35))'
    : selected
      ? 'drop-shadow(0 2px 8px rgba(15, 23, 42, 0.06))'
      : 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.04))';

  return { fill, stroke, strokeWidth, boxShadow, dropShadow };
}

export function renderSketchSurface(input: {
  primitives: ShapePrimitive[];
  surface: RenderSurface;
  seedId: string | number;
  isDark: boolean;
  shape?: string | null;
}): string {
  const renderer = getStrokeRenderer('rough');
  const seed = typeof input.seedId === 'string' ? renderer.seedFor(input.seedId) : input.seedId;
  // Sketch boosts stroke width slightly for the rough.js hand-drawn feel.
  const sketchSurface: RenderSurface = {
    fill: input.surface.fill,
    stroke: input.surface.stroke,
    strokeWidth: Math.max(1.75, input.surface.strokeWidth * 1.2),
  };
  return renderSketchBodyMarkup(
    input.primitives,
    sketchSurface,
    seed,
    input.isDark,
    input.shape,
  );
}
