/**
 * @feature DynamicHandleSelection
 * @protected true
 * @description Step 1 of the connection pipeline: determines which side of
 *   each node an edge connects to. Purely geometric — compares the raw
 *   center-to-center direction (dx, dy) without normalizing by node
 *   dimensions.  The side with the larger absolute delta wins; ties go
 *   to the horizontal axis (Left/Right), matching the standard React
 *   Flow floating-edge convention.
 *
 *   This is intentionally simple and dimension-agnostic.  Node size is
 *   irrelevant to "which side faces the other node" — that is purely
 *   a directional question.  Routing, clipping, and collision avoidance
 *   are handled downstream by edgeRouteBuilder.
 *
 * @do-not-modify Without explicit instruction from the user.
 * @do-not-delete This file implements core edge routing behavior.
 * @affects SimpleFloatingEdge, useAutoLayout, elkLayoutService
 *
 * @last-updated 2026-07-20
 */

import { Position } from 'reactflow';
import {
  selectBestHandlerPair,
  type HandlerRect,
} from '../utils/handlerPairScorer';
import logger from '@/lib/logger';

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
 * Step 1 of the connection pipeline — determines which side of each node
 * an edge connects to.  For each node independently, the raw center-to-
 * center direction is compared: whichever axis has the larger absolute
 * delta wins:
 *   - |dx| > |dy|  →  Left/Right handles  (ties also go here)
 *   - |dy| > |dx|  →  Top/Bottom handles
 *
 * Because the same deterministic rule is applied with negated deltas for
 * each node, the result is always an opposite pair (Left↔Right,
 * Top↔Bottom).
 */
export function getDynamicHandles(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  edgeId?: string,
  sourceId?: string,
  targetId?: string,
  direction: 'LR' | 'TD' = 'LR'
): DynamicHandleResult {
  void direction;

  const sourceCX = sourceRect.x + sourceRect.width / 2;
  const sourceCY = sourceRect.y + sourceRect.height / 2;
  const targetCX = targetRect.x + targetRect.width / 2;
  const targetCY = targetRect.y + targetRect.height / 2;

  const dx = targetCX - sourceCX;
  const dy = targetCY - sourceCY;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }

  // Post-layout assertion: verify the coordinates we received are sane.
  // If these fail, getDynamicHandles is being called with pre-layout or
  // stale node positions — the caller must pass post-layout rects.
  if (process.env.NODE_ENV !== 'production') {
    const badSource =
      !isFinite(sourceRect.x) || !isFinite(sourceRect.y) ||
      !isFinite(sourceRect.width) || !isFinite(sourceRect.height) ||
      sourceRect.width < 0 || sourceRect.height < 0;
    const badTarget =
      !isFinite(targetRect.x) || !isFinite(targetRect.y) ||
      !isFinite(targetRect.width) || !isFinite(targetRect.height) ||
      targetRect.width < 0 || targetRect.height < 0;
    if (badSource || badTarget) {
      logger.warn(
        '[getDynamicHandles] INVALID input rects — expected post-layout coordinates. ' +
        'source=(%d,%d %dx%d) target=(%d,%d %dx%d)',
        sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
        targetRect.x, targetRect.y, targetRect.width, targetRect.height,
      );
    }
  }

  if (process.env.NEXT_PUBLIC_DEBUG_HANDLES === 'true') {
    logger.debug('[getDynamicHandles] edge=%s src=%s tgt=%s', edgeId, sourceId, targetId);
    logger.debug('[getDynamicHandles] source rect: x=%d y=%d w=%d h=%d', sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
    logger.debug('[getDynamicHandles] target rect: x=%d y=%d w=%d h=%d', targetRect.x, targetRect.y, targetRect.width, targetRect.height);
    logger.debug('[getDynamicHandles] source center: (%d, %d)  target center: (%d, %d)', sourceCX, sourceCY, targetCX, targetCY);
    logger.debug('[getDynamicHandles] dx=%d dy=%d', dx, dy);
  }

  const sourcePosition = pickAxisSide(dx, dy);
  const targetPosition = pickAxisSide(-dx, -dy);

  if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
    console.log('[EdgeDebug:1-Geometric] edge=%s  src=%s→%s  tgt=%s→%s  dx=%d dy=%d',
      edgeId, sourceId, sourcePosition, targetId, targetPosition, dx, dy);
  }

  return { sourcePosition, targetPosition };
}

/**
 * Picks a handle side from the raw center-to-center direction vector.
 * Whichever axis has the larger absolute delta wins; ties go to the
 * horizontal axis (Left/Right), matching the standard React Flow
 * floating-edge convention.
 *
 * This is intentionally dimension-agnostic.  Node width/height are
 * irrelevant to "which side faces the other node" — that is purely a
 * directional question.  The node's bounding box size matters only for
 * anchor computation (step 3) and clipping (step 5), not side selection.
 */
function pickAxisSide(dx: number, dy: number): Position {
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? Position.Bottom : Position.Top;
  }
  return dx > 0 ? Position.Right : Position.Left;
}

/**
 * Gets the XY coordinate of a handle on a node rect for a given Position side.
 * Right and Bottom handles are shifted outward (12px) for cleaner edge routing.
 * Used by SimpleFloatingEdge to compute exact edge start/end points.
 */
const OUTER_OFFSET = 12;

export function getSemanticPortSide(
  sourceServiceType: string,
  targetServiceType: string,
  portType?: string,
  direction: 'LR' | 'TD' = 'LR'
): { sourceSide: Position; targetSide: Position } {
  const isLR = direction === 'LR';
  const leftSide = isLR ? Position.Left : Position.Top;
  const rightSide = isLR ? Position.Right : Position.Bottom;
  const topSide = isLR ? Position.Top : Position.Left;
  const bottomSide = isLR ? Position.Bottom : Position.Right;

  // Specific Overrides: Database target
  if (targetServiceType === 'database') {
    if (portType === 'events') return { sourceSide: rightSide, targetSide: rightSide };
    if (portType === 'control') return { sourceSide: topSide, targetSide: topSide };
    if (portType === 'storage') return { sourceSide: rightSide, targetSide: bottomSide };
    return { sourceSide: rightSide, targetSide: leftSide };
  }

  // Queue
  if (targetServiceType === 'queue') {
    if (portType === 'control') return { sourceSide: topSide, targetSide: topSide };
    if (portType === 'events') return { sourceSide: rightSide, targetSide: bottomSide };
    return { sourceSide: rightSide, targetSide: leftSide };
  }
  if (sourceServiceType === 'queue') {
    return { sourceSide: rightSide, targetSide: leftSide };
  }

  // API Gateway
  if (sourceServiceType === 'load-balancer') {
    if (portType === 'control' || portType === 'security') return { sourceSide: topSide, targetSide: leftSide };
    if (portType === 'observability') return { sourceSide: bottomSide, targetSide: leftSide };
    return { sourceSide: rightSide, targetSide: leftSide };
  }

  // Default general mapping based on portType
  switch (portType) {
    case 'control':
      return { sourceSide: topSide, targetSide: topSide };
    case 'data':
    case 'storage':
    case 'runtime':
      return { sourceSide: rightSide, targetSide: bottomSide };
    case 'observability':
      return { sourceSide: bottomSide, targetSide: bottomSide };
    case 'security':
      return { sourceSide: topSide, targetSide: topSide };
    case 'events':
      return { sourceSide: rightSide, targetSide: leftSide };
    case 'inbound':
      return { sourceSide: leftSide, targetSide: leftSide };
    case 'outbound':
      return { sourceSide: rightSide, targetSide: leftSide };
    default:
      return { sourceSide: rightSide, targetSide: leftSide };
  }
}

function sideFromData(value: unknown): Position | undefined {
  if (value === 'left' || value === Position.Left) return Position.Left;
  if (value === 'right' || value === Position.Right) return Position.Right;
  if (value === 'top' || value === Position.Top) return Position.Top;
  if (value === 'bottom' || value === Position.Bottom) return Position.Bottom;
  return undefined;
}

/**
 * Obstacle-aware handle selection — same scorer as computeEdgeRoute so
 * persisted sourceHandle/targetHandle match the rendered edge sides.
 */
export function getObstacleAwareHandles(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  nodeRects?: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
  excludedNodeIds?: Set<string>,
  edgeId?: string,
  sourceId?: string,
  targetId?: string,
  edgeData?: Record<string, unknown>,
  sourceServiceType?: string,
  targetServiceType?: string,
  direction: 'LR' | 'TD' = 'LR',
  preferredPair?: { sourcePosition: Position; targetPosition: Position },
): DynamicHandleResult {
  void edgeId;
  void sourceId;
  void targetId;
  void sourceServiceType;
  void targetServiceType;

  const obstacles = new Map<string, HandlerRect>();
  if (nodeRects) {
    for (const [id, r] of nodeRects) {
      obstacles.set(id, { x: r.x, y: r.y, width: r.w, height: r.h });
    }
  }

  const manualSource =
    preferredPair?.sourcePosition ??
    sideFromData(edgeData?.sourceSide);
  const manualTarget =
    preferredPair?.targetPosition ??
    sideFromData(edgeData?.targetSide);
  const laneSource = sideFromData(edgeData?.laneSourceSide);
  const laneTarget = sideFromData(edgeData?.laneTargetSide);

  const pair = selectBestHandlerPair(
    sourceRect,
    targetRect,
    direction,
    obstacles.size > 0 ? obstacles : undefined,
    excludedNodeIds,
    manualSource,
    manualTarget,
    laneSource,
    laneTarget,
  );

  return {
    sourcePosition: pair.sourceSide,
    targetPosition: pair.targetSide,
  };
}

export function getHandleCoordinate(
  rect: NodeRect,
  position: Position,
  _type?: 'source' | 'target',
  _isBidirectional: boolean = true
): { x: number; y: number } {
  void _isBidirectional;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const offset = 0;

  switch (position) {
    case Position.Top:    return { x: cx + offset, y: rect.y - OUTER_OFFSET };
    case Position.Bottom: return { x: cx + offset, y: rect.y + rect.height + OUTER_OFFSET };
    case Position.Left:   return { x: rect.x - OUTER_OFFSET, y: cy + offset };
    case Position.Right:  return { x: rect.x + rect.width + OUTER_OFFSET, y: cy + offset };
    default:              return { x: cx, y: cy };
  }
}
