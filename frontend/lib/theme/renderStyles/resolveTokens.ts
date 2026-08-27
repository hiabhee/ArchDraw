import {
  BORDER_RADIUS,
  STROKE_WIDTH,
  getDiagramTheme,
  diagramThemeCssVars,
  type DiagramThemeId,
} from '@/lib/theme/stylingConstants';
import type { DiagramRenderStyleId, ResolvedCanvasTokens } from './types';
import { getRenderStyle } from './registry';
import { getStrokeRenderer } from './strokeRenderer';
import {
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_PAPER_DARK_BORDER,
  SKETCH_INK_LIGHT_TITLE,
  SKETCH_INK_LIGHT_SUBTITLE,
  SKETCH_INK_LIGHT_BORDER,
  SKETCH_INK_LIGHT_EDGE,
  SKETCH_GROUP_FILL_LIGHT,
  SKETCH_GROUP_STROKE_LIGHT,
  SKETCH_CANVAS_BG_LIGHT,
  SKETCH_GRID_COLOR_LIGHT,
  SKETCH_INK_DARK_TITLE,
  SKETCH_INK_DARK_SUBTITLE,
  SKETCH_INK_DARK_EDGE,
  SKETCH_GROUP_FILL_DARK,
  SKETCH_GROUP_STROKE_DARK,
  SKETCH_CANVAS_BG_DARK,
  SKETCH_GRID_COLOR_DARK,
  SKETCH_EDGE_PRIMARY_LIGHT,
  SKETCH_EDGE_PRIMARY_DARK,
  SKETCH_EDGE_ASYNC_LIGHT,
  SKETCH_EDGE_ASYNC_DARK,
} from './sketch';

export interface ResolveCanvasTokensOpts {
  renderStyleId: DiagramRenderStyleId | string | null;
  colorThemeId?: DiagramThemeId | string | null;
  isDark: boolean;
}

/**
 * Single resolver for every canvas consumer — merges render style × color
 * theme × light/dark into `ResolvedCanvasTokens`.
 */
export function resolveCanvasTokens(opts: ResolveCanvasTokensOpts): ResolvedCanvasTokens {
  const render = getRenderStyle(opts.renderStyleId);
  const color = getDiagramTheme(opts.colorThemeId ?? 'default');
  const mode = opts.isDark ? color.dark : color.light;

  const strokeWidth = STROKE_WIDTH * render.geometry.strokeWidthScale;
  const borderRadius = BORDER_RADIUS * render.geometry.borderRadiusScale;

  const isSketch = render.strokeEngine === 'rough';

  const baseVars = diagramThemeCssVars(opts.colorThemeId ?? 'default', opts.isDark);
  const cssVars: Record<string, string> = {
    ...baseVars,
    '--arch-render-style': render.id,
    '--arch-font-title': render.fonts.title,
    '--arch-font-subtitle': render.fonts.subtitle,
    '--arch-font-edge-label': render.fonts.edgeLabel,
    '--arch-font-annotation': render.fonts.annotation,
    '--arch-stroke-width': `${strokeWidth}px`,
    '--arch-radius': `${borderRadius}px`,
    '--arch-canvas-bg': isSketch
      ? (opts.isDark ? `hsl(${SKETCH_CANVAS_BG_DARK})` : `hsl(${SKETCH_CANVAS_BG_LIGHT})`)
      : 'hsl(var(--canvas-bg))',
    '--arch-canvas-grid': isSketch
      ? (opts.isDark ? `hsl(${SKETCH_GRID_COLOR_DARK})` : `hsl(${SKETCH_GRID_COLOR_LIGHT})`)
      : 'hsl(var(--grid-color))',
    // Clean paper overrides for sketch so CSS vars and resolved colors stay in sync
    ...(isSketch
      ? {
          '--arch-node-fill': opts.isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT,
          '--arch-node-stroke': opts.isDark ? SKETCH_PAPER_DARK_BORDER : SKETCH_INK_LIGHT_BORDER,
          '--arch-title': opts.isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE,
          '--arch-subtitle': opts.isDark ? SKETCH_INK_DARK_SUBTITLE : SKETCH_INK_LIGHT_SUBTITLE,
          '--arch-group-fill': opts.isDark ? SKETCH_GROUP_FILL_DARK : SKETCH_GROUP_FILL_LIGHT,
          '--arch-group-stroke': opts.isDark ? SKETCH_GROUP_STROKE_DARK : SKETCH_GROUP_STROKE_LIGHT,
          '--arch-edge-default': opts.isDark ? SKETCH_INK_DARK_EDGE : SKETCH_INK_LIGHT_EDGE,
          '--arch-edge-primary': opts.isDark ? SKETCH_EDGE_PRIMARY_DARK : SKETCH_EDGE_PRIMARY_LIGHT,
          '--arch-edge-async': opts.isDark ? SKETCH_EDGE_ASYNC_DARK : SKETCH_EDGE_ASYNC_LIGHT,
          '--canvas-bg': opts.isDark ? SKETCH_CANVAS_BG_DARK : SKETCH_CANVAS_BG_LIGHT,
          '--grid-color': opts.isDark ? SKETCH_GRID_COLOR_DARK : SKETCH_GRID_COLOR_LIGHT,
        }
      : {}),
  };

  // Sketch uses clean paper + hand-ink palette; keep concern colors intact (orthogonal)
  const nodeFill = isSketch
    ? opts.isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT
    : mode.nodeFill;
  const nodeStroke = isSketch
    ? opts.isDark ? SKETCH_PAPER_DARK_BORDER : SKETCH_INK_LIGHT_BORDER
    : mode.nodeStroke;
  const title = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE
    : mode.title;
  const subtitle = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_SUBTITLE : SKETCH_INK_LIGHT_SUBTITLE
    : mode.subtitle;
  const groupFill = isSketch
    ? opts.isDark ? SKETCH_GROUP_FILL_DARK : SKETCH_GROUP_FILL_LIGHT
    : mode.groupFill;
  const groupStroke = isSketch
    ? opts.isDark ? SKETCH_GROUP_STROKE_DARK : SKETCH_GROUP_STROKE_LIGHT
    : mode.groupStroke;
  const edgeDefault = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_EDGE : SKETCH_INK_LIGHT_EDGE
    : mode.edgeDefault;
  const edgeAsync = isSketch
    ? opts.isDark ? SKETCH_EDGE_ASYNC_DARK : SKETCH_EDGE_ASYNC_LIGHT
    : mode.edgeAsync;
  const edgePrimary = isSketch
    ? opts.isDark ? SKETCH_EDGE_PRIMARY_DARK : SKETCH_EDGE_PRIMARY_LIGHT
    : mode.edgePrimary;

  return {
    render,
    renderStyleId: render.id,
    colorThemeId: opts.colorThemeId ?? 'default',
    isDark: opts.isDark,
    strokeRenderer: getStrokeRenderer(render.strokeEngine),
    colors: {
      nodeFill,
      nodeStroke,
      title,
      subtitle,
      groupFill,
      groupStroke,
      edgeDefault,
      edgePrimary,
      edgeAsync,
      shadow: mode.shadow,
    },
    concerns: color.concerns,
    strokeWidth,
    borderRadius,
    fonts: render.fonts,
    cssVars,
  };
}
