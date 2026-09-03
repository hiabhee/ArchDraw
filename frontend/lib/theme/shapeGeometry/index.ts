import type { ShapeType } from '@/lib/shapeRegistry';
import type { ShapePrimitive } from '@/lib/theme/renderStyles/types';

export type { ShapePrimitive };
export type { ShapeType };

export type ShapeGeometryAxis = 'vertical' | 'horizontal';

/**
 * Shape geometry catalog — Layer 2 of the aesthetic-themes architecture.
 * `getShapePrimitives` returns style-agnostic primitives; both `ShapeNode`
 * (canvas) and the SVG export render them through a `StrokeRenderer`.
 */
export function getShapePrimitives(
  shape: ShapeType,
  width: number,
  height: number,
  axis?: ShapeGeometryAxis,
  isSketch?: boolean,  // Add sketch mode flag for simplified rendering
): ShapePrimitive[] {
  const W = width;
  const H = height;
  switch (shape) {
    case 'rectangle':
    case 'rounded-rectangle':
      return rectanglePrimitives(W, H, shape === 'rounded-rectangle');
    case 'dashed-rectangle':
      return dashedRectanglePrimitives(W, H);
    case 'diamond':
      return diamondPrimitives(W, H);
    case 'circle':
      return circlePrimitives(W, H);
    case 'parallelogram':
      return parallelogramPrimitives(W, H);
    case 'hexagon':
      return hexagonPrimitives(W, H);
    case 'cylinder':
      return axis === 'horizontal' 
        ? (isSketch ? horizontalPipeSketchPrimitives(W, H) : horizontalPipePrimitives(W, H))
        : (isSketch ? verticalDrumSketchPrimitives(W, H) : verticalDrumPrimitives(W, H));
    case 'cloud':
      return cloudPrimitives(W, H);
    case 'actor':
      return actorPrimitives(W, H);
    case 'monitor':
      return monitorPrimitives(W, H);
    case 'mobile':
      return mobilePrimitives(W, H);
    // Architecture-native semantic silhouettes (Phase 1)
    case 'queue':
      return queuePrimitives(W, H);
    case 'cache':
      return cachePrimitives(W, H);
    case 'function':
      return functionPrimitives(W, H);
    case 'container':
      return containerPrimitives(W, H);
    case 'bucket':
      return bucketPrimitives(W, H);
    case 'document':
      return documentPrimitives(W, H);
    case 'documents':
      return documentsPrimitives(W, H);
    default:
      return rectanglePrimitives(W, H, false);
  }
}

// ── rectangle / rounded-rectangle ─────────────────────────────────────────────

export function rectanglePrimitives(W: number, H: number, rounded: boolean): ShapePrimitive[] {
  return [
    {
      kind: rounded ? 'rounded-rect' : 'rect',
      bounds: { x: 1, y: 1, width: W - 2, height: H - 2 },
      rx: rounded ? 10 : 6,
      fillable: true,
    },
  ];
}

export function dashedRectanglePrimitives(W: number, H: number): ShapePrimitive[] {
  return [
    {
      kind: 'rounded-rect',
      bounds: { x: 1, y: 1, width: W - 2, height: H - 2 },
      rx: 10,
      dasharray: '6 4',
      fillable: true,
    },
  ];
}

// ── diamond ───────────────────────────────────────────────────────────────────

export function diamondPrimitives(W: number, H: number): ShapePrimitive[] {
  const pts = `${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`;
  return [{ kind: 'polygon', bounds: { x: 0, y: 0, width: W, height: H }, points: pts, fillable: true }];
}

// ── circle ────────────────────────────────────────────────────────────────────

export function circlePrimitives(W: number, H: number): ShapePrimitive[] {
  return [
    {
      kind: 'ellipse',
      bounds: { x: 2, y: 2, width: W - 4, height: H - 4 },
      fillable: true,
    },
  ];
}

// ── parallelogram ─────────────────────────────────────────────────────────────

export function parallelogramPrimitives(W: number, H: number): ShapePrimitive[] {
  const skew = Math.min(16, Math.round(W * 0.08));
  const pts = `${skew},4 ${W - 4},4 ${W - skew - 4},${H - 4} 4,${H - 4}`;
  return [{ kind: 'polygon', bounds: { x: 0, y: 0, width: W, height: H }, points: pts, fillable: true }];
}

// ── hexagon (flat-top, ingress / LB / gateway) ───────────────────────────────

export function hexagonPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const qx = Math.max(10, Math.round(W * 0.22));
  const pts = [
    `${qx},${inset}`,
    `${W - qx},${inset}`,
    `${W - inset},${H / 2}`,
    `${W - qx},${H - inset}`,
    `${qx},${H - inset}`,
    `${inset},${H / 2}`,
  ].join(' ');
  return [
    {
      kind: 'polygon',
      bounds: { x: 0, y: 0, width: W, height: H },
      points: pts,
      strokeLinejoin: 'round',
      fillable: true,
    },
  ];
}

// ── cylinder (vertical drum / horizontal pipe) ───────────────────────────────

export function verticalDrumPrimitives(W: number, H: number): ShapePrimitive[] {
  const RY = Math.max(10, Math.round(H * 0.12));
  const rx = (W - 4) / 2;
  const left = 2;
  const right = W - 2;
  const topY = RY;
  const bottomY = H - RY;
  const silhouette = [
    `M ${left} ${topY}`,
    `L ${left} ${bottomY}`,
    `A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
    `L ${right} ${topY}`,
    `A ${rx} ${RY} 0 0 1 ${left} ${topY}`,
    'Z',
  ].join(' ');
  return [
    { kind: 'path', bounds: { x: 0, y: 0, width: W, height: H }, d: silhouette, fillable: true },
    { kind: 'rect', bounds: { x: left, y: topY, width: W - 4, height: bottomY - topY } },
    {
      kind: 'ellipse',
      bounds: { x: 2, y: bottomY - RY, width: W - 4, height: RY * 2 },
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${left} ${bottomY} A ${rx} ${RY} 0 0 1 ${right} ${bottomY}`,
      dasharray: '4 3',
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${left} ${bottomY} A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: left,
      y1: topY,
      x2: left,
      y2: bottomY,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: right,
      y1: topY,
      x2: right,
      y2: bottomY,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'ellipse',
      bounds: { x: 2, y: topY - RY, width: W - 4, height: RY * 2 },
      fillable: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: silhouette,
      strokeLinejoin: 'round',
      strokeOnly: true,
    },
  ];
}

// ── sketch cylinder primitives (same structure as normal, for wobbly rendering) ──

export function verticalDrumSketchPrimitives(W: number, H: number): ShapePrimitive[] {
  const RY = Math.max(10, Math.round(H * 0.12));
  const rx = (W - 4) / 2;
  const left = 2;
  const right = W - 2;
  const topY = RY;
  const bottomY = H - RY;
  
  const silhouette = [
    `M ${left} ${topY}`,
    `L ${left} ${bottomY}`,
    `A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
    `L ${right} ${topY}`,
    `A ${rx} ${RY} 0 0 1 ${left} ${topY}`,
    'Z',
  ].join(' ');
  
  return [
    { kind: 'path', bounds: { x: 0, y: 0, width: W, height: H }, d: silhouette, fillable: true },
    { kind: 'rect', bounds: { x: left, y: topY, width: W - 4, height: bottomY - topY } },
    {
      kind: 'ellipse',
      bounds: { x: 2, y: bottomY - RY, width: W - 4, height: RY * 2 },
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${left} ${bottomY} A ${rx} ${RY} 0 0 1 ${right} ${bottomY}`,
      dasharray: '4 3',
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${left} ${bottomY} A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: left,
      y1: topY,
      x2: left,
      y2: bottomY,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: right,
      y1: topY,
      x2: right,
      y2: bottomY,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'ellipse',
      bounds: { x: 2, y: topY - RY, width: W - 4, height: RY * 2 },
      fillable: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: silhouette,
      strokeLinejoin: 'round',
      strokeOnly: true,
    },
  ];
}

export function horizontalPipeSketchPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const R = Math.max(8, Math.round((H - inset * 2) / 2));
  const midY = H / 2;
  const leftCx = inset + R;
  const rightCx = W - inset - R;
  const bodyTop = midY - R;
  const bodyBot = midY + R;
  const bodyW = Math.max(0, rightCx - leftCx);

  const silhouette = [
    `M ${leftCx - R} ${midY}`,
    `A ${R} ${R} 0 0 1 ${leftCx} ${bodyTop}`,
    `L ${rightCx} ${bodyTop}`,
    `A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
    `L ${leftCx} ${bodyBot}`,
    `A ${R} ${R} 0 0 1 ${leftCx - R} ${midY}`,
    'Z',
  ].join(' ');

  const primitives: ShapePrimitive[] = [
    // Fill the capsule body — ensures opaque paper in sketch (was missing, caused transparent right side)
    { kind: 'path', bounds: { x: 0, y: 0, width: W, height: H }, d: silhouette, fillable: true },
  ];
  if (bodyW > 0) {
    primitives.push({
      kind: 'rect',
      bounds: { x: leftCx, y: bodyTop, width: bodyW, height: R * 2 },
    });
  }
  primitives.push(
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: leftCx,
      y1: bodyTop,
      x2: rightCx,
      y2: bodyTop,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: leftCx,
      y1: bodyBot,
      x2: rightCx,
      y2: bodyBot,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 0 ${rightCx} ${bodyBot}`,
      dasharray: '4 3',
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'ellipse',
      bounds: { x: leftCx - R, y: midY - R, width: R * 2, height: R *2 },
      fillable: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: silhouette,
      strokeLinejoin: 'round',
      strokeOnly: true,
    },
  );
  return primitives;
}

export function horizontalPipePrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const R = Math.max(8, Math.round((H - inset * 2) / 2));
  const midY = H / 2;
  const leftCx = inset + R;
  const rightCx = W - inset - R;
  const bodyTop = midY - R;
  const bodyBot = midY + R;
  const bodyW = Math.max(0, rightCx - leftCx);

  const silhouette = [
    `M ${leftCx - R} ${midY}`,
    `A ${R} ${R} 0 0 1 ${leftCx} ${bodyTop}`,
    `L ${rightCx} ${bodyTop}`,
    `A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
    `L ${leftCx} ${bodyBot}`,
    `A ${R} ${R} 0 0 1 ${leftCx - R} ${midY}`,
    'Z',
  ].join(' ');

  const primitives: ShapePrimitive[] = [
    { kind: 'path', bounds: { x: 0, y: 0, width: W, height: H }, d: silhouette, fillable: true },
  ];
  if (bodyW > 0) {
    primitives.push({
      kind: 'rect',
      bounds: { x: leftCx, y: bodyTop, width: bodyW, height: R * 2 },
      strokeOnly: true,
    });
  }
  primitives.push(
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: leftCx,
      y1: bodyTop,
      x2: rightCx,
      y2: bodyTop,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: leftCx,
      y1: bodyBot,
      x2: rightCx,
      y2: bodyBot,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 0 ${rightCx} ${bodyBot}`,
      dasharray: '4 3',
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
    {
      kind: 'ellipse',
      bounds: { x: leftCx - R, y: midY - R, width: R * 2, height: R * 2 },
      fillable: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: silhouette,
      strokeLinejoin: 'round',
      strokeOnly: true,
    },
  );
  return primitives;
}

// ── cloud (external / SaaS / third-party) ─────────────────────────────────────

export function cloudPrimitives(W: number, H: number): ShapePrimitive[] {
  const s = W / 200;
  const pt = (x: number, y: number) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`;
  const R = (r: number) => (r * s).toFixed(1);
  const d = [
    `M ${pt(44, 102)}`,
    `A ${R(26)} ${R(26)} 0 0 1 ${pt(34, 68)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(82, 34)}`,
    `A ${R(34)} ${R(34)} 0 0 1 ${pt(148, 42)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(170, 78)}`,
    `A ${R(24)} ${R(24)} 0 0 1 ${pt(156, 102)}`,
    'Z',
  ].join(' ');
  return [{ kind: 'path', bounds: { x: 0, y: 0, width: W, height: H }, d, strokeLinejoin: 'round', fillable: true }];
}

// ── actor (end user / person) ────────────────────────────────────────────────
// Two-part person glyph: round head + rounded-shoulder body, touching at seam.
// Both parts share the same surface fill/stroke so the combined glyph reads
// as one filled person silhouette behind the centered label.
//
// The glyph is drawn inside a "person box" with a FIXED natural aspect ratio
// (body width vs. height) that is centered within the W×H node. Head size is
// derived from the person's height only, so the head stays round and the person
// never gets stretched regardless of the node's box proportions.

export function actorPrimitives(W: number, H: number): ShapePrimitive[] {
  const RATIO = 0.72; // wider person box so body can contain title (expand bottom space)
  const ph = Math.min(H, W / RATIO);
  const pw = ph * RATIO;
  const px0 = Math.round((W - pw) / 2);
  const py0 = Math.round((H - ph) / 2);

  const topPad = Math.max(3, Math.round(ph * 0.04));
  const d = Math.max(18, Math.round(ph * 0.28)); // slightly smaller head leaves more body
  const gap = Math.max(1, Math.round(ph * 0.02));
  const bodyH = Math.max(28, Math.round(ph * 0.42)); // expanded bottom

  const headX = Math.round(px0 + (pw - d) / 2);
  const headY = py0 + topPad;

  const bodyW = Math.max(36, Math.round(pw * 0.78)); // wider torso contains title
  const bodyX = Math.round(px0 + (pw - bodyW) / 2);
  const bodyY = Math.round(headY + d + gap);
  const r = Math.min(14, Math.round(bodyH * 0.5), Math.round(bodyW * 0.16));

  const bodyPath = [
    `M ${bodyX} ${bodyY + bodyH}`,
    `L ${bodyX} ${bodyY + r}`,
    `Q ${bodyX} ${bodyY} ${bodyX + r} ${bodyY}`,
    `L ${bodyX + bodyW - r} ${bodyY}`,
    `Q ${bodyX + bodyW} ${bodyY} ${bodyX + bodyW} ${bodyY + r}`,
    `L ${bodyX + bodyW} ${bodyY + bodyH}`,
    'Z',
  ].join(' ');

  return [
    {
      kind: 'ellipse',
      bounds: { x: headX, y: headY, width: d, height: d },
      fillable: true,
    },
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: bodyPath,
      strokeLinejoin: 'round',
      fillable: true,
    },
  ];
}

// ── monitor (web / desktop client) ────────────────────────────────────────────

export function monitorPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const screenH = H - 20;
  const screenR = 6;
  const screen = [
    `M ${inset} ${inset + screenR}`,
    `Q ${inset} ${inset} ${inset + screenR} ${inset}`,
    `L ${W - inset - screenR} ${inset}`,
    `Q ${W - inset} ${inset} ${W - inset} ${inset + screenR}`,
    `L ${W - inset} ${inset + screenH}`,
    `Q ${W - inset} ${inset + screenH} ${W - inset - 4} ${inset + screenH}`,
    `L ${inset + 4} ${inset + screenH}`,
    `Q ${inset} ${inset + screenH} ${inset} ${inset + screenH}`,
    'Z',
  ].join(' ');
  const neckY = inset + screenH;
  const standW = Math.round(W * 0.32);
  return [
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: screen,
      strokeLinejoin: 'round',
      fillable: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: W / 2,
      y1: neckY,
      x2: W / 2,
      y2: neckY + 6,
      strokeOnly: true,
    },
    {
      kind: 'rect',
      bounds: { x: W / 2 - Math.round(W * 0.16), y: neckY + 6, width: standW, height: 3 },
      rx: 1.5,
      fillAsStroke: true,
    },
  ];
}

// ── mobile (phone client) ─────────────────────────────────────────────────────

export function mobilePrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const r = Math.max(6, Math.round(W * 0.09));
  return [
    {
      kind: 'rounded-rect',
      bounds: { x: inset, y: inset, width: W - inset * 2, height: H - inset * 2 },
      rx: r,
      fillable: true,
    },
    {
      kind: 'rect',
      bounds: { x: W / 2 - 8, y: Math.round(H * 0.1), width: 16, height: 3 },
      rx: 1.5,
      opacity: 0.7,
      fillAsStroke: true,
    },
    {
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: W / 2,
      y1: H - Math.round(H * 0.12),
      x2: W / 2,
      y2: H - Math.round(H * 0.05),
      strokeWidth: 2,
      strokeOnly: true,
      strokeLinecap: 'round',
    },
  ];
}

// ── queue (horizontal message-lane silhouette) ────────────────────────────────

/**
 * Horizontal message-lane shape for async streams, queues, topics, event buses.
 * Outer rounded-rect body + three subtle internal horizontal lane strokes.
 */
export function queuePrimitives(W: number, H: number): ShapePrimitive[] {
  const pad = 2;
  const r = Math.min(14, Math.round(H * 0.24));
  const laneY = [0.36, 0.5, 0.64].map((n) => Math.round(H * n));
  return [
    {
      kind: 'rounded-rect',
      bounds: { x: pad, y: pad, width: W - pad * 2, height: H - pad * 2 },
      rx: r,
      fillable: true,
    },
    ...laneY.map((y) => ({
      kind: 'line' as const,
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: Math.round(W * 0.16),
      y1: y,
      x2: Math.round(W * 0.76),
      y2: y,
      strokeOnly: true,
      strokeLinecap: 'round' as const,
    })),
  ];
}

// ── cache (stacked memory / fast-store silhouette) ────────────────────────────

/**
 * Refined stacked-layers for Redis/Memcached/CDN.
 * Subtle offset (3px) + two faint back plates + two inner lines hinting
 * cached entries. Much lighter than prior 5px/10px shift - no heavy bottom
 * bar in neubrutalism, still reads as “layered fast store”.
 */
export function cachePrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const r = Math.max(8, Math.round(W * 0.075));
  const off = 3;
  // Back plates — only top edge peeks, stroke-only, low opacity via renderer
  const layer2: ShapePrimitive = {
    kind: 'rounded-rect',
    bounds: {
      x: inset + off * 2,
      y: inset,
      width: W - inset * 2 - off * 2,
      height: H - inset * 2 - off,
    },
    rx: r,
    strokeOnly: true,
    opacity: 0.45,
  };
  const layer1: ShapePrimitive = {
    kind: 'rounded-rect',
    bounds: {
      x: inset + off,
      y: inset + off * 0.5,
      width: W - inset * 2 - off,
      height: H - inset * 2 - off,
    },
    rx: r,
    strokeOnly: true,
    opacity: 0.6,
  };
  // Main front body
  const body: ShapePrimitive = {
    kind: 'rounded-rect',
    bounds: { x: inset, y: inset + off, width: W - inset * 2, height: H - inset * 2 - off },
    rx: r,
    fillable: true,
  };
  // Two subtle inner lines — hint “cached rows” without clutter
  const innerY1 = Math.round(H * 0.38);
  const innerY2 = Math.round(H * 0.58);
  const lx = Math.round(W * 0.18);
  const rx2 = Math.round(W * 0.82);
  const line1: ShapePrimitive = {
    kind: 'line',
    bounds: { x: 0, y: 0, width: W, height: H },
    x1: lx, y1: innerY1, x2: rx2, y2: innerY1,
    strokeOnly: true,
    opacity: 0.18,
    strokeLinecap: 'round',
  };
  const line2: ShapePrimitive = {
    kind: 'line',
    bounds: { x: 0, y: 0, width: W, height: H },
    x1: lx, y1: innerY2, x2: rx2, y2: innerY2,
    strokeOnly: true,
    opacity: 0.18,
    strokeLinecap: 'round',
  };
  return [layer2, layer1, body, line1, line2];
}

// ── function (serverless / edge function silhouette) ──────────────────────────

/**
 * Compact angled-corner rectangle for Lambda, Cloud Functions, edge workers.
 * Distinct from long-running compute by the angled left/right cuts.
 */
export function functionPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const cut = Math.max(10, Math.round(H * 0.18));
  // Hexagonal / angled-corner outline
  const pts = [
    `${inset + cut},${inset}`,
    `${W - inset - cut},${inset}`,
    `${W - inset},${inset + cut}`,
    `${W - inset},${H - inset - cut}`,
    `${W - inset - cut},${H - inset}`,
    `${inset + cut},${H - inset}`,
    `${inset},${H - inset - cut}`,
    `${inset},${inset + cut}`,
  ].join(' ');
  return [
    {
      kind: 'polygon',
      bounds: { x: 0, y: 0, width: W, height: H },
      points: pts,
      strokeLinejoin: 'round',
      fillable: true,
    },
  ];
}

// ── container / pod (workload unit silhouette) ────────────────────────────────

/**
 * Nested workload shape for Docker containers, Kubernetes pods.
 * Main rounded-rect body + three small inset cell blocks in the upper-left area.
 */
export function containerPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const r = Math.max(6, Math.round(W * 0.06));
  const cellW = Math.round(W * 0.14);
  const cellH = Math.round(H * 0.22);
  const cellY = Math.round(H * 0.14);
  const gap = Math.round(W * 0.04);
  const startX = Math.round(W * 0.12);

  const cells: ShapePrimitive[] = [0, 1, 2].map((i) => ({
    kind: 'rounded-rect' as const,
    bounds: {
      x: startX + i * (cellW + gap),
      y: cellY,
      width: cellW,
      height: cellH,
    },
    rx: 3,
    strokeOnly: true,
  }));

  return [
    {
      kind: 'rounded-rect',
      bounds: { x: inset, y: inset, width: W - inset * 2, height: H - inset * 2 },
      rx: r,
      fillable: true,
    },
    ...cells,
  ];
}

// ── bucket (object / blob storage silhouette) ────────────────────────────────

/**
 * Tapered bucket/trapezoid body with curved top rim for S3, GCS, Azure Blob.
 * Distinct from vertical cylinder databases.
 */
export function bucketPrimitives(W: number, H: number): ShapePrimitive[] {
  const taper = Math.round(W * 0.08);
  const rimH = Math.max(10, Math.round(H * 0.16));
  const inset = 2;

  // Bucket body — trapezoid (wider at top, narrower at bottom)
  const bodyPts = [
    `${inset},${inset + rimH}`,
    `${W - inset},${inset + rimH}`,
    `${W - inset - taper},${H - inset}`,
    `${inset + taper},${H - inset}`,
  ].join(' ');

  // Top ellipse rim
  const rimCY = inset + rimH;
  const rimRX = (W - inset * 2) / 2;
  const rimRY = Math.max(4, Math.round(rimH * 0.55));

  return [
    // Body fill polygon
    {
      kind: 'polygon',
      bounds: { x: 0, y: 0, width: W, height: H },
      points: bodyPts,
      strokeLinejoin: 'round',
      fillable: true,
    },
    // Top oval rim (stroke-only)
    {
      kind: 'ellipse',
      bounds: {
        x: inset,
        y: rimCY - rimRY,
        width: W - inset * 2,
        height: rimRY * 2,
      },
      strokeOnly: true,
    },
    // Bottom of the rim arc that overlaps the body top (visible seam)
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: `M ${inset} ${rimCY} A ${rimRX} ${rimRY} 0 0 0 ${W - inset} ${rimCY}`,
      strokeLinecap: 'round',
      strokeOnly: true,
    },
  ];
}


// ── document (single document silhouette) ─────────────────────────────────────

/**
 * Document shape — single rounded-corner page with horizontal text lines.
 * Represents files, documents, reports, configuration files.
 */
export function documentPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const cornerRadius = Math.max(12, Math.round(W * 0.14));
  
  // Main document body with rounded corners (single plate, no stacked layers)
  const docPath = [
    `M ${inset} ${inset + cornerRadius}`,
    `Q ${inset} ${inset} ${inset + cornerRadius} ${inset}`,
    `L ${W - inset - cornerRadius} ${inset}`,
    `Q ${W - inset} ${inset} ${W - inset} ${inset + cornerRadius}`,
    `L ${W - inset} ${H - inset - cornerRadius}`,
    `Q ${W - inset} ${H - inset} ${W - inset - cornerRadius} ${H - inset}`,
    `L ${inset + cornerRadius} ${H - inset}`,
    `Q ${inset} ${H - inset} ${inset} ${H - inset - cornerRadius}`,
    'Z',
  ].join(' ');
  
  // Horizontal lines representing text
  const lineCount = 12;
  const lineStartY = Math.round(H * 0.15);
  const lineEndY = Math.round(H * 0.88);
  const lineSpacing = (lineEndY - lineStartY) / (lineCount - 1);
  const lineLeft = Math.round(W * 0.14);
  const lineRight = Math.round(W * 0.72);
  
  const contentLines: ShapePrimitive[] = [];
  for (let i = 0; i < lineCount; i++) {
    const y = lineStartY + i * lineSpacing;
    const rightOffset = i % 3 === 2 ? Math.round(W * 0.1) : 0;
    contentLines.push({
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: lineLeft,
      y1: y,
      x2: lineRight - rightOffset,
      y2: y,
      strokeOnly: true,
      strokeLinecap: 'round',
      opacity: 0.4,
    });
  }
  
  return [
    // Main document body
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: docPath,
      strokeLinejoin: 'round',
      fillable: true,
    },
    // Content lines
    ...contentLines,
  ];
}

// ── documents (multiple stacked documents) ────────────────────────────────────

/**
 * Multiple documents with stacked back-plates to signify more than one document.
 * Represents document collections, file sets, multiple records.
 */
export function documentsPrimitives(W: number, H: number): ShapePrimitive[] {
  const inset = 2;
  const stackOffset = 4;
  const cornerRadius = Math.max(12, Math.round(W * 0.14));

  // Back stacked pages (3 layers visible behind the front document)
  const stackLayers: ShapePrimitive[] = [];
  for (let i = 2; i >= 0; i--) {
    const offsetX = i * stackOffset;
    const layerPath = [
      `M ${W - inset - offsetX} ${inset + cornerRadius}`,
      `Q ${W - inset - offsetX} ${inset} ${W - inset - offsetX - cornerRadius} ${inset}`,
      `L ${W - inset - stackOffset * 3} ${inset}`,
      `L ${W - inset - stackOffset * 3} ${H - inset}`,
      `L ${W - inset - offsetX - cornerRadius} ${H - inset}`,
      `Q ${W - inset - offsetX} ${H - inset} ${W - inset - offsetX} ${H - inset - cornerRadius}`,
      'Z',
    ].join(' ');

    stackLayers.push({
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: layerPath,
      strokeLinejoin: 'round',
      strokeOnly: true,
    });
  }

  // Front document body with rounded corners
  const docPath = [
    `M ${inset} ${inset + cornerRadius}`,
    `Q ${inset} ${inset} ${inset + cornerRadius} ${inset}`,
    `L ${W - inset - stackOffset * 3 - cornerRadius} ${inset}`,
    `Q ${W - inset - stackOffset * 3} ${inset} ${W - inset - stackOffset * 3} ${inset + cornerRadius}`,
    `L ${W - inset - stackOffset * 3} ${H - inset - cornerRadius}`,
    `Q ${W - inset - stackOffset * 3} ${H - inset} ${W - inset - stackOffset * 3 - cornerRadius} ${H - inset}`,
    `L ${inset + cornerRadius} ${H - inset}`,
    `Q ${inset} ${H - inset} ${inset} ${H - inset - cornerRadius}`,
    'Z',
  ].join(' ');

  // Horizontal lines representing text
  const lineCount = 12;
  const lineStartY = Math.round(H * 0.15);
  const lineEndY = Math.round(H * 0.88);
  const lineSpacing = (lineEndY - lineStartY) / (lineCount - 1);
  const lineLeft = Math.round(W * 0.14);
  const lineRight = Math.round(W * 0.72);

  const contentLines: ShapePrimitive[] = [];
  for (let i = 0; i < lineCount; i++) {
    const y = lineStartY + i * lineSpacing;
    const rightOffset = i % 3 === 2 ? Math.round(W * 0.1) : 0;
    contentLines.push({
      kind: 'line',
      bounds: { x: 0, y: 0, width: W, height: H },
      x1: lineLeft,
      y1: y,
      x2: lineRight - rightOffset,
      y2: y,
      strokeOnly: true,
      strokeLinecap: 'round',
      opacity: 0.4,
    });
  }

  return [
    // Stacked page layers (back to front)
    ...stackLayers,
    // Front document body
    {
      kind: 'path',
      bounds: { x: 0, y: 0, width: W, height: H },
      d: docPath,
      strokeLinejoin: 'round',
      fillable: true,
    },
    // Content lines
    ...contentLines,
  ];
}
