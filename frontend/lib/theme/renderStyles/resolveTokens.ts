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

  const cssVars: Record<string, string> = {
    ...diagramThemeCssVars(opts.colorThemeId ?? 'default', opts.isDark),
    '--arch-render-style': render.id,
    '--arch-font-title': render.fonts.title,
    '--arch-font-subtitle': render.fonts.subtitle,
    '--arch-font-edge-label': render.fonts.edgeLabel,
    '--arch-font-annotation': render.fonts.annotation,
    '--arch-stroke-width': `${strokeWidth}px`,
    '--arch-radius': `${borderRadius}px`,
    '--arch-canvas-bg': 'hsl(var(--canvas-bg))',
    '--arch-canvas-grid': 'hsl(var(--grid-color))',
  };

  const isSketch = render.strokeEngine === 'rough';

  // Sketch now uses precision colors — no per-style color overrides needed.
  // The base diagramThemeCssVars already provides the correct palette.

  // Mirror the overrides into the resolved color tokens so non-CSS consumers
  // (SystemNode sketch body, GroupNode tint, exports) read the same palette.
  // Sketch now uses precision colors — no per-style override needed.
  const nodeFill = mode.nodeFill;
  const nodeStroke = mode.nodeStroke;
  const title = mode.title;
  const subtitle = mode.subtitle;
  const groupFill = mode.groupFill;
  const groupStroke = mode.groupStroke;
  const edgeDefault = mode.edgeDefault;
  const edgeAsync = mode.edgeAsync;

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
      edgePrimary: mode.edgePrimary,
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
