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
  type HandlerRect,
} from '../utils/handlerPairScorer';

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

  return {
    sourcePosition: pair.sourceSide,
    targetPosition: pair.targetSide,
  };
}
