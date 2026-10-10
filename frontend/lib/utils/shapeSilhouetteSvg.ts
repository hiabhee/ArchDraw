/**
 * SVG body paths for semantic ShapeNode silhouettes.
 * Refactored to flow through `shapeGeometry` primitives + a `StrokeRenderer`
 * so canvas ↔ export stay aligned. Geometry matches `components/ShapeNode.tsx`.
 */
import { getShapePrimitives, type ShapeType } from '@/lib/theme/shapeGeometry';
import {
  applyShapeSurface,
  getStrokeRenderer,
  renderSketchBodyMarkup,
  type DiagramRenderStyleId,
  type RenderSurface,
} from '@/lib/theme/renderStyles';

export type { RenderSurface as ShapeSurfaceSvg };

const SEMANTIC_SHAPES: readonly ShapeType[] = [
  'hexagon',
  'cloud',
  'actor',
  'monitor',
  'mobile',
  'dashed-rectangle',
  // Architecture-native semantic silhouettes (Phase 1)
  'queue',
  'cache',
  'function',
  'container',
  'bucket',
];

function renderPrimitives(
  shape: ShapeType,
  W: number,
  H: number,
  surface: RenderSurface,
  renderStyleId: DiagramRenderStyleId,
  isDark = false,
): string {
  const primitives = getShapePrimitives(shape, W, H);
  const seed = getStrokeRenderer(renderStyleId === 'sketch' ? 'rough' : renderStyleId === 'neubrutalism' ? 'brutalist' : 'crisp').seedFor(
    `shape-body-${shape}-${W}x${H}`,
  );

  if (renderStyleId === 'sketch') {
    return renderSketchBodyMarkup(primitives, surface, seed, isDark, shape);
  }

  if (renderStyleId === 'neubrutalism') {
    const renderer = getStrokeRenderer('brutalist');
    const decorated = applyShapeSurface(primitives, surface);
    if (shape === 'dashed-rectangle') {
      decorated[0] = {
        ...decorated[0],
        fill: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
      };
    }
    let out = decorated.map((p) => renderer.renderPrimitive(p, seed)).join('\n');
    if (isDark) out = out.split('url(#brutal-shadow)').join('url(#brutal-shadow-dark)');
    return out;
  }

  const renderer = getStrokeRenderer('crisp');
  const decorated = applyShapeSurface(primitives, surface);

  if (shape === 'dashed-rectangle') {
    decorated[0] = {
      ...decorated[0],
      fill: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
    };
  }

  return decorated.map((p) => renderer.renderPrimitive(p, seed)).join('\n');
}

export function hexagonBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('hexagon', W, H, surface, 'precision');
}

export function cloudBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('cloud', W, H, surface, 'precision');
}

export function actorBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('actor', W, H, surface, 'precision');
}

export function monitorBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('monitor', W, H, surface, 'precision');
}

export function mobileBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('mobile', W, H, surface, 'precision');
}

export function dashedRectangleBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('dashed-rectangle', W, H, surface, 'precision');
}

export function queueBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('queue', W, H, surface, 'precision');
}

export function cacheBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('cache', W, H, surface, 'precision');
}

export function functionBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('function', W, H, surface, 'precision');
}

export function containerBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('container', W, H, surface, 'precision');
}

export function bucketBodySvg(W: number, H: number, surface: RenderSurface): string {
  return renderPrimitives('bucket', W, H, surface, 'precision');
}

/**
 * Returns SVG markup for semantic silhouettes; null when the shape is not
 * handled here. `renderStyleId` picks the stroke engine (sketch → rough).
 */
export function semanticShapeBodySvg(
  shape: string,
  W: number,
  H: number,
  surface: RenderSurface,
  isDark = false,
  renderStyleId: DiagramRenderStyleId = 'precision',
): string | null {
  if (!SEMANTIC_SHAPES.includes(shape as ShapeType)) return null;
  return renderPrimitives(shape as ShapeType, W, H, surface, renderStyleId, isDark);
}
