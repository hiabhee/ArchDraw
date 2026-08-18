export type {
  DiagramRenderStyleId,
  StrokeEngineId,
  ShapePrimitive,
  EdgeStrokeOpts,
  Point,
  RenderStylePack,
  ResolvedCanvasTokens,
} from './types';
export { RENDER_STYLES, getRenderStyle, isRenderStyleId, DEFAULT_RENDER_STYLE_ID } from './registry';
export { PRECISION_RENDER_STYLE } from './precision';
export {
  SKETCH_RENDER_STYLE,
  SKETCH_ROUGH_OPTIONS,
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_PAPER_DARK_BORDER,
  SKETCH_INK_WARM,
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
  SKETCH_STREAM_INK,
  SKETCH_EVENT_INK,
  SKETCH_HATCH_INK_LIGHT,
  SKETCH_HATCH_INK_DARK,
  sketchHatchInk,
  sketchFillForShape,
  sketchEdgeInk,
  type SketchEdgeInk,
} from './sketch';
export { renderSketchBodyMarkup } from './sketchBody';
export { resolveCanvasTokens, type ResolveCanvasTokensOpts } from './resolveTokens';
export { ensureSketchFontLoaded } from './loadSketchFont';
export { applyShapeSurface, type RenderSurface } from './applySurface';
export { resolveRenderSurface, renderSketchSurface, type ResolveRenderSurfaceInput } from './surface';
export type { StrokeRenderer } from './strokeRenderer/types';
export { getStrokeRenderer } from './strokeRenderer';

