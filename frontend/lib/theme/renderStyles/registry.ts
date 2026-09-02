import type { DiagramRenderStyleId, RenderStylePack } from './types';
import { PRECISION_RENDER_STYLE } from './precision';
import { SKETCH_RENDER_STYLE } from './sketch';
import { NEUBRUTALISM_RENDER_STYLE } from './neubrutalism';

/** Render-style registry — the canonical set of aesthetic packs. */
export const RENDER_STYLES: Record<DiagramRenderStyleId, RenderStylePack> = {
  precision: PRECISION_RENDER_STYLE,
  sketch: SKETCH_RENDER_STYLE,
  neubrutalism: NEUBRUTALISM_RENDER_STYLE,
};

export const DEFAULT_RENDER_STYLE_ID: DiagramRenderStyleId = 'precision';

export function getRenderStyle(id?: DiagramRenderStyleId | string | null): RenderStylePack {
  if (id && id in RENDER_STYLES) return RENDER_STYLES[id as DiagramRenderStyleId];
  return RENDER_STYLES[DEFAULT_RENDER_STYLE_ID];
}

export function isRenderStyleId(value: string | null | undefined): value is DiagramRenderStyleId {
  return value != null && value in RENDER_STYLES;
}
