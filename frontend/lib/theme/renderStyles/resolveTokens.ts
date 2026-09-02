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
import {
  BRUTAL_FILL_LIGHT,
  BRUTAL_FILL_DARK,
  BRUTAL_BORDER,
  BRUTAL_BORDER_DARK,
  BRUTAL_TITLE_LIGHT,
  BRUTAL_TITLE_DARK,
  BRUTAL_SUBTITLE_LIGHT,
  BRUTAL_SUBTITLE_DARK,
  BRUTAL_GROUP_FILL_LIGHT,
  BRUTAL_GROUP_FILL_DARK,
  BRUTAL_EDGE_DEFAULT_LIGHT,
  BRUTAL_EDGE_DEFAULT_DARK,
  BRUTAL_EDGE_PRIMARY_LIGHT,
  BRUTAL_EDGE_PRIMARY_DARK,
  BRUTAL_EDGE_ASYNC_LIGHT,
  BRUTAL_EDGE_ASYNC_DARK,
  BRUTAL_CANVAS_BG_LIGHT,
  BRUTAL_CANVAS_BG_DARK,
  BRUTAL_GRID_LIGHT,
  BRUTAL_GRID_DARK,
} from './neubrutalism';

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
  const isBrutal = render.strokeEngine === 'brutalist';

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
      : isBrutal
        ? (opts.isDark ? `hsl(${BRUTAL_CANVAS_BG_DARK})` : `hsl(${BRUTAL_CANVAS_BG_LIGHT})`)
        : 'hsl(var(--canvas-bg))',
    '--arch-canvas-grid': isSketch
      ? (opts.isDark ? `hsl(${SKETCH_GRID_COLOR_DARK})` : `hsl(${SKETCH_GRID_COLOR_LIGHT})`)
      : isBrutal
        ? (opts.isDark ? `hsl(${BRUTAL_GRID_DARK})` : `hsl(${BRUTAL_GRID_LIGHT})`)
        : 'hsl(var(--grid-color))',
    // Style-specific CSS overrides so resolved colors stay in sync
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
      : isBrutal
        ? {
            '--arch-node-fill': opts.isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT,
            '--arch-node-stroke': opts.isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER,
            '--arch-title': opts.isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT,
            '--arch-subtitle': opts.isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT,
            '--arch-group-fill': opts.isDark ? BRUTAL_GROUP_FILL_DARK : BRUTAL_GROUP_FILL_LIGHT,
            '--arch-group-stroke': opts.isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER,
            '--arch-edge-default': opts.isDark ? BRUTAL_EDGE_DEFAULT_DARK : BRUTAL_EDGE_DEFAULT_LIGHT,
            '--arch-edge-primary': opts.isDark ? BRUTAL_EDGE_PRIMARY_DARK : BRUTAL_EDGE_PRIMARY_LIGHT,
            '--arch-edge-async': opts.isDark ? BRUTAL_EDGE_ASYNC_DARK : BRUTAL_EDGE_ASYNC_LIGHT,
            '--canvas-bg': opts.isDark ? BRUTAL_CANVAS_BG_DARK : BRUTAL_CANVAS_BG_LIGHT,
            '--grid-color': opts.isDark ? BRUTAL_GRID_DARK : BRUTAL_GRID_LIGHT,
          }
        : {}),
  };

  // Style-specific resolved color palette; keep concern colors intact (orthogonal)
  const nodeFill = isSketch
    ? opts.isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT
    : isBrutal
      ? opts.isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT
      : mode.nodeFill;
  const nodeStroke = isSketch
    ? opts.isDark ? SKETCH_PAPER_DARK_BORDER : SKETCH_INK_LIGHT_BORDER
    : isBrutal
      ? opts.isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER
      : mode.nodeStroke;
  const title = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE
    : isBrutal
      ? opts.isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT
      : mode.title;
  const subtitle = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_SUBTITLE : SKETCH_INK_LIGHT_SUBTITLE
    : isBrutal
      ? opts.isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT
      : mode.subtitle;
  const groupFill = isSketch
    ? opts.isDark ? SKETCH_GROUP_FILL_DARK : SKETCH_GROUP_FILL_LIGHT
    : isBrutal
      ? opts.isDark ? BRUTAL_GROUP_FILL_DARK : BRUTAL_GROUP_FILL_LIGHT
      : mode.groupFill;
  const groupStroke = isSketch
    ? opts.isDark ? SKETCH_GROUP_STROKE_DARK : SKETCH_GROUP_STROKE_LIGHT
    : isBrutal
      ? opts.isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER
      : mode.groupStroke;
  const edgeDefault = isSketch
    ? opts.isDark ? SKETCH_INK_DARK_EDGE : SKETCH_INK_LIGHT_EDGE
    : isBrutal
      ? opts.isDark ? BRUTAL_EDGE_DEFAULT_DARK : BRUTAL_EDGE_DEFAULT_LIGHT
      : mode.edgeDefault;
  const edgeAsync = isSketch
    ? opts.isDark ? SKETCH_EDGE_ASYNC_DARK : SKETCH_EDGE_ASYNC_LIGHT
    : isBrutal
      ? opts.isDark ? BRUTAL_EDGE_ASYNC_DARK : BRUTAL_EDGE_ASYNC_LIGHT
      : mode.edgeAsync;
  const edgePrimary = isSketch
    ? opts.isDark ? SKETCH_EDGE_PRIMARY_DARK : SKETCH_EDGE_PRIMARY_LIGHT
    : isBrutal
      ? opts.isDark ? BRUTAL_EDGE_PRIMARY_DARK : BRUTAL_EDGE_PRIMARY_LIGHT
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
