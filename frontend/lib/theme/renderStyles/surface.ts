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
import {
  BRUTAL_FILL_LIGHT,
  BRUTAL_FILL_DARK,
  BRUTAL_BORDER,
  BRUTAL_BORDER_DARK,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_OFFSET,
} from './neubrutalism';
import { renderSketchBodyMarkup } from './sketchBody';
import { getStrokeRenderer } from './strokeRenderer';

function hexToRgba(hex: string, alpha: number): string {
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const brutal = input.renderStyleId === 'neubrutalism';
  const styles = input.nodeStyle ?? (input.isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES);
  const selected = input.selected ?? false;
  const accentColor = input.accentColor ?? '#0f766e';

  // Sketch: clean paper fill + hand-ink border; brutal: flat fill + heavy black
  const fill = sketch
    ? input.isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT
    : brutal
      ? input.isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT
      : input.isDark ? styles.background : '#ffffff';
  // Brutal selection: saturated accent ring (bold, not muted).
  const stroke = selected
    ? sketch
      ? hexToRgba(accentColor, input.isDark ? 0.52 : 0.44)
      : brutal
        ? accentColor
        : accentColor
    : sketch
      ? input.isDark ? SKETCH_PAPER_DARK_BORDER : SKETCH_INK_LIGHT_BORDER
      : brutal
        ? input.isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER
        : input.isDark
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(15, 23, 42, 0.14)';
  const strokeWidth = selected ? (brutal ? 3.5 : sketch ? 2 : 2) : brutal ? 3.25 : sketch ? 1.35 : 1.25;
  // Brutal has a hard offset shadow; sketch none; precision soft.
  const boxShadow = brutal
    ? `${BRUTAL_SHADOW_OFFSET}px ${BRUTAL_SHADOW_OFFSET}px 0px ${BRUTAL_SHADOW}`
    : sketch ? 'none' : selected ? styles.shadowSelected : styles.shadow;
  const dropShadow = brutal
    ? 'none'
    : sketch
      ? 'none'
      : input.isDark
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
  // Sketch boosts stroke width for hand-drawn ink; keep selected slightly thinner
  const sketchSurface: RenderSurface = {
    fill: input.surface.fill,
    stroke: input.surface.stroke,
    strokeWidth: Math.max(1.65, input.surface.strokeWidth * 1.28),
  };
  // Honor per-surface fillStyle (GroupNode passes hachure) else fall back to shape map
  const nextSurface = input.surface.fillStyle
    ? { ...sketchSurface, fillStyle: input.surface.fillStyle }
    : sketchSurface;
  return renderSketchBodyMarkup(
    input.primitives,
    nextSurface,
    seed,
    input.isDark,
    input.shape,
  );
}
