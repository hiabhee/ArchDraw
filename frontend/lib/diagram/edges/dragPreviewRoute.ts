import type { Position } from 'reactflow';
import {
  anchorOutsideBoundary,
  buildDefaultOrthogonalWaypoints,
  selectBestHandlerPair,
  type HandlerRect,
} from './handlerPairScorer';

/**
 * The edge drawn for a node that is being dragged. It is rebuilt on every drag
 * frame from the two nodes' current boxes alone (no obstacle map, no whole-diagram
 * plan), so it is cheap, and it picks the sides the same way the final route does:
 * drag a node past the other and the edge moves from one side to the facing one as
 * you go, instead of keeping the sides it had when the drag began and jumping on drop.
 */
export interface DragPreviewRoute {
  sourcePosition: Position;
  targetPosition: Position;
  /** First point is where the edge leaves the source, last is where it reaches the target. */
  waypoints: Array<{ x: number; y: number }>;
}

export function buildDragPreviewRoute(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  direction: 'LR' | 'TD' = 'LR',
): DragPreviewRoute {
  const pair = selectBestHandlerPair(sourceRect, targetRect, direction);
  const start = anchorOutsideBoundary(sourceRect, pair.sourceSide);
  const end = anchorOutsideBoundary(targetRect, pair.targetSide);
  return {
    sourcePosition: pair.sourceSide,
    targetPosition: pair.targetSide,
    waypoints: buildDefaultOrthogonalWaypoints(start, end, pair.sourceSide, pair.targetSide, 0),
  };
}
