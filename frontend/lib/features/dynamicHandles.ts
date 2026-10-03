/**
 * @feature DynamicHandleSelection
 * @protected true
 * @description Obstacle-aware handle selection used when persisting edge
 *   handle positions. Uses the same scorer as computeEdgeRoute so stored
 *   sourceHandle/targetHandle match rendered edge sides.
 *
 * @do-not-modify Without explicit instruction from the user.
 * @do-not-delete This file implements core edge routing behavior.
 * @affects diagramStore.recalculateHandles, edgeRouteBuilder
 */

import { Position } from 'reactflow';
import {
  selectBestHandlerPair,
  scoreAllHandlerPairs,
  buildDefaultOrthogonalWaypoints,
  anchorOutsideBoundary,
  type HandlerRect,
} from '../utils/handlerPairScorer';
import { segmentIntersectsRect } from '../utils/collisionFreeEdgePath';

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

  // Mirror computeEdgeRoute / useHandleSlotLayout: a facing pair whose
  // default orthogonal path tunnels through a terminal must fall back,
  // otherwise the persisted handle ids disagree with the rendered sides.
  const customWaypoints = edgeData?.customWaypoints;
  const usesCustomWaypoints = Array.isArray(customWaypoints) && customWaypoints.length > 0;
  if (
    (manualSource === undefined || manualTarget === undefined) &&
    !usesCustomWaypoints
  ) {
    const fallback = scoreAllHandlerPairs(
      sourceRect,
      targetRect,
      direction,
      obstacles.size > 0 ? obstacles : undefined,
      excludedNodeIds,
    )
      .map((s) => {
        // Same -50 lane bias selectBestHandlerPair applies internally.
        let total = s.total;
        if (laneSource !== undefined && s.pair.sourceSide === laneSource) total -= 50;
        if (laneTarget !== undefined && s.pair.targetSide === laneTarget) total -= 50;
        return { ...s, total };
      })
      .sort((a, b) => a.total - b.total)
      .find((s) => {
        if (manualSource !== undefined && s.pair.sourceSide !== manualSource) return false;
        if (manualTarget !== undefined && s.pair.targetSide !== manualTarget) return false;
        if (s.pair.sourceSide === pair.sourceSide && s.pair.targetSide === pair.targetSide) return false;
        return !orthogonalPenetratesTerminal(sourceRect, targetRect, s.pair.sourceSide, s.pair.targetSide);
      });
    if (fallback && orthogonalPenetratesTerminal(sourceRect, targetRect, pair.sourceSide, pair.targetSide)) {
      return {
        sourcePosition: fallback.pair.sourceSide,
        targetPosition: fallback.pair.targetSide,
      };
    }
  }

  return {
    sourcePosition: pair.sourceSide,
    targetPosition: pair.targetSide,
  };
}

/**
 * Same terminal-penetration check as computeEdgeRoute: endpoints sit 12px
 * outside the node, so a correct path never enters either interior.
 */
function orthogonalPenetratesTerminal(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  sourceSide: Position,
  targetSide: Position,
): boolean {
  const srcA = anchorOutsideBoundary(sourceRect, sourceSide);
  const tgtA = anchorOutsideBoundary(targetRect, targetSide);
  const waypoints = buildDefaultOrthogonalWaypoints(srcA, tgtA, sourceSide, targetSide);
  const pad = 2;
  const shrink = (r: HandlerRect): HandlerRect => ({
    x: r.x + pad,
    y: r.y + pad,
    width: Math.max(1, r.width - pad * 2),
    height: Math.max(1, r.height - pad * 2),
  });
  const src = shrink(sourceRect);
  const tgt = shrink(targetRect);
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, src.x, src.y, src.width, src.height)) return true;
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, tgt.x, tgt.y, tgt.width, tgt.height)) return true;
  }
  return false;
}
