import logger from '@/lib/logger';
/**
 * @feature DynamicHandleSelection
 * @protected true
 * @description Dynamically selects edge source/target handles based on 
 *   relative node positions. For each edge, picks the handle pair (from all
 *   4 sides) that minimizes Manhattan distance between the two handle
 *   positions — automatically giving the shortest possible edge path.
 * 
 * @do-not-modify Without explicit instruction from the user.
 * @do-not-delete This file implements core edge routing behavior.
 * @affects SimpleFloatingEdge, useAutoLayout, elkLayoutService
 * 
 * @last-updated 2026-07-07
 */

import { Position } from 'reactflow';
import { getCollisionFreeWaypoints } from '../utils/collisionFreeEdgePath';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DynamicHandleResult {
  sourcePosition: Position;
  targetPosition: Position;
}

/**
 * Given two node rects, picks the handle pair (source side + target side)
 * that gives the shortest Manhattan distance between the two handles.
 * This naturally routes each edge through the side closest to its target:
 * - target below  → bottom→top
 * - target above  → top→bottom
 * - target right  → right→left
 * - target left   → left→right
 * — without any gap-ratio heuristic or axis bias.
 */
export function getDynamicHandles(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  edgeId?: string,
  sourceId?: string,
  targetId?: string
): DynamicHandleResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const debug = process.env.NEXT_PUBLIC_DEBUG_HANDLES === 'true';

  let dx = 0;
  let dy = 0;
  let sourceCX = 0;
  let sourceCY = 0;
  let targetCX = 0;
  let targetCY = 0;
  
  try {
    sourceCX = sourceRect.x + sourceRect.width / 2;
    sourceCY = sourceRect.y + sourceRect.height / 2;
    targetCX = targetRect.x + targetRect.width / 2;
    targetCY = targetRect.y + targetRect.height / 2;
    
    if (isNaN(sourceCX) || isNaN(sourceCY) || isNaN(targetCX) || isNaN(targetCY)) {
      throw new Error('Invalid rect');
    }

    dx = targetCX - sourceCX;
    dy = targetCY - sourceCY;

    if (Math.abs(dx) < 1e-9) dx = 0;
    if (Math.abs(dy) < 1e-9) dy = 0;
  } catch {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }

  // Pick the shorter axis by computing actual handle-to-handle Manhattan distance
  // for two candidates:
  //   - Horizontal (Right→Left or Left→Right based on dx)
  //   - Vertical   (Bottom→Top or Top→Bottom based on dy)
  //
  // Using center-to-center direction for WHICH pair within an axis guarantees
  // symmetry (A→B and B→A always reverse correctly), while the distance
  // comparison between axes picks the truly shorter path.
  const useRight = dx > 0 || (dx === 0 && dy >= 0);
  const useBottom = dy > 0 || (dy === 0 && dx > 0);

  const horizontalSourcePos = useRight ? Position.Right : Position.Left;
  const horizontalTargetPos = useRight ? Position.Left : Position.Right;
  const verticalSourcePos = useBottom ? Position.Bottom : Position.Top;
  const verticalTargetPos = useBottom ? Position.Top : Position.Bottom;

  const hsh = getHandleCoordinate(sourceRect, horizontalSourcePos);
  const hth = getHandleCoordinate(targetRect, horizontalTargetPos);
  const horizontalDist = Math.abs(hth.x - hsh.x) + Math.abs(hth.y - hsh.y);

  const vsh = getHandleCoordinate(sourceRect, verticalSourcePos);
  const vth = getHandleCoordinate(targetRect, verticalTargetPos);
  const verticalDist = Math.abs(vth.x - vsh.x) + Math.abs(vth.y - vsh.y);

  // When distances are essentially equal (within 1e-6), prefer the axis
  // suggested by center-to-center direction. This guarantees symmetry:
  // A→B and B→A will reverse correctly when distances tie.
  const DIST_EPSILON = 1e-6;
  const useVertical = Math.abs(verticalDist - horizontalDist) > DIST_EPSILON
    ? verticalDist < horizontalDist
    : Math.abs(dy) > Math.abs(dx);

  const sourcePosition = useVertical ? verticalSourcePos : horizontalSourcePos;
  const targetPosition = useVertical ? verticalTargetPos : horizontalTargetPos;

  if (debug) {
    logger.info('[DynamicHandles] Calculation:', {
      edgeId,
      sourceId,
      targetId,
      nodeCenter: {
        source: { x: sourceCX, y: sourceCY },
        target: { x: targetCX, y: targetCY },
      },
      dx,
      dy,
    });

    logger.info('[DynamicHandles] Selected handles:', {
      edgeId,
      sourceId,
      targetId,
      sourcePosition,
      targetPosition,
      horizontalDist,
      verticalDist,
    });

    logger.info('[DynamicHandles] Performance:', {
      edgeId,
      elapsedMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start,
    });
  }

  return { sourcePosition, targetPosition };
}

/**
 * Gets the XY coordinate of a handle on a node rect for a given Position side.
 * Right and Bottom handles are shifted outward (12px) for cleaner edge routing.
 * Used by SimpleFloatingEdge to compute exact edge start/end points.
 */
const OUTER_OFFSET = 12;

function lineIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
  const code = (x: number, y: number) => {
    let c = INSIDE;
    if (x < rx) c |= LEFT;
    else if (x > rx + rw) c |= RIGHT;
    if (y < ry) c |= TOP;
    else if (y > ry + rh) c |= BOTTOM;
    return c;
  };
  let c1 = code(x1, y1), c2 = code(x2, y2);
  while (true) {
    if (!(c1 | c2)) return true;
    if (c1 & c2) return false;
    const c = c1 || c2;
    let x = 0, y = 0;
    if (c & BOTTOM) { x = x1 + (x2 - x1) * (ry + rh - y1) / (y2 - y1); y = ry + rh; }
    else if (c & TOP) { x = x1 + (x2 - x1) * (ry - y1) / (y2 - y1); y = ry; }
    else if (c & RIGHT) { y = y1 + (y2 - y1) * (rx + rw - x1) / (x2 - x1); x = rx + rw; }
    else if (c & LEFT) { y = y1 + (y2 - y1) * (rx - x1) / (x2 - x1); x = rx; }
    if (c === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
    else { x2 = x; y2 = y; c2 = code(x2, y2); }
  }
}

export function getObstacleAwareHandles(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  nodeRects?: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
  excludedNodeIds?: Set<string>,
  edgeId?: string,
  sourceId?: string,
  targetId?: string,
): DynamicHandleResult {
  const defaultHandles = getDynamicHandles(sourceRect, targetRect, edgeId, sourceId, targetId);

  if (!nodeRects || nodeRects.size === 0) {
    return defaultHandles;
  }

  const allPositions = [Position.Left, Position.Right, Position.Top, Position.Bottom];
  const allPairs: Array<{ source: Position; target: Position }> = [];
  for (const s of allPositions) {
    for (const t of allPositions) {
      allPairs.push({ source: s, target: t });
    }
  }

  const rects = nodeRects!;
  const excluded = excludedNodeIds ?? new Set();

  function scorePair(sp: Position, tp: Position): { collisions: number; pathLen: number } {
    // No type passed — compute handle coordinates at the node edge center,
    // matching getSimpleHandlePosition used for actual edge drawing.
    const sh = getHandleCoordinate(sourceRect, sp);
    const th = getHandleCoordinate(targetRect, tp);
    const sx = sh.x, sy = sh.y, tx = th.x, ty = th.y;

    const waypoints = getCollisionFreeWaypoints({
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
      sourcePosition: sp,
      targetPosition: tp,
      nodeRects: rects,
      excludedNodeIds: excluded
    });

    let collisions = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      for (const [nid, rect] of rects) {
        if (excluded.has(nid)) continue;
        if (lineIntersectsRect(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y, rect.x, rect.y, rect.w, rect.h)) {
          collisions++;
        }
      }
    }

    let pathLen = 0;
    for (let i = 1; i < waypoints.length; i++) {
      pathLen += Math.abs(waypoints[i].x - waypoints[i - 1].x) + Math.abs(waypoints[i].y - waypoints[i - 1].y);
    }

    return { collisions, pathLen };
  }

  const defaultScore = scorePair(defaultHandles.sourcePosition, defaultHandles.targetPosition);
  if (defaultScore.collisions === 0) {
    return defaultHandles;
  }

  let best = { ...defaultScore, pair: defaultHandles };

  for (const pair of allPairs) {
    if (pair.source === defaultHandles.sourcePosition && pair.target === defaultHandles.targetPosition) continue;
    const score = scorePair(pair.source, pair.target);
    if (score.collisions < best.collisions || (score.collisions === best.collisions && score.pathLen < best.pathLen)) {
      best = { ...score, pair: { sourcePosition: pair.source, targetPosition: pair.target } };
    }
  }

  return best.pair;
}

export function getHandleCoordinate(
  rect: NodeRect,
  position: Position,
  type?: 'source' | 'target',
  isBidirectional: boolean = true
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  
  let offset = 0;
  if (isBidirectional && type) {
    if (type === 'source') {
      offset = 12;
    } else if (type === 'target') {
      offset = -12;
    }
  }

  switch (position) {
    case Position.Top:    return { x: cx + offset, y: rect.y - OUTER_OFFSET };
    case Position.Bottom: return { x: cx + offset, y: rect.y + rect.height + OUTER_OFFSET };
    case Position.Left:   return { x: rect.x - OUTER_OFFSET, y: cy + offset };
    case Position.Right:  return { x: rect.x + rect.width + OUTER_OFFSET, y: cy + offset };
    default:              return { x: cx, y: cy };
  }
}
