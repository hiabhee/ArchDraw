/**
 * @feature HandlerPairScorer
 * @description Scores all possible source–target handler pairs for an edge
 *   and returns the lowest-scoring (best) pair. Side selection runs BEFORE
 *   routing, using a deterministic scoring function that considers:
 *
 *   1. Facing / nearest handlers — prefer sides that face the other node
 *   2. Handler distance — prefer shorter connections
 *   3. Expected bend count — prefer fewer turns
 *   4. Obstacle avoidance — avoid default orthogonal paths that collide
 *   5. Directional consistency — soft preference for LR/TD layout flow
 *
 *   The scorer produces exactly one winner. No special-case logic.
 *   Every node pair is evaluated identically.
 */

import { Position } from '@/lib/utils/edgePositions';
import { segmentIntersectsRect } from './collisionFreeEdgePath';
import logger from '@/lib/logger';

export interface HandlerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HandlerPair {
  sourceSide: Position;
  targetSide: Position;
}

export interface HandlerPairScore {
  pair: HandlerPair;
  total: number;
  distance: number;
  bends: number;
  collides: boolean;
  directional: boolean;
  terminal: boolean;
}

const ALL_SIDES: Position[] = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

const HORIZONTAL_SIDES: Position[] = [
  Position.Left,
  Position.Right,
];

function getAllowedSides(horizontalOnly?: boolean): Position[] {
  return horizontalOnly ? HORIZONTAL_SIDES : ALL_SIDES;
}

function clampToHorizontal(pos: Position | undefined, horizontalOnly?: boolean): Position | undefined {
  if (!horizontalOnly) return pos;
  if (pos === Position.Top || pos === Position.Bottom) return undefined;
  return pos;
}

/** Matches getBoundaryAnchor / EDGE_ENDPOINT_GAP (12) in simpleFloatingEdge. */
export const HANDLER_ENDPOINT_GAP = 12;

function isHorizontal(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

/**
 * Returns the anchor point on the node boundary for a given side.
 */
export function anchorOnBoundary(
  rect: HandlerRect,
  side: Position,
): { x: number; y: number } {
  switch (side) {
    case Position.Left:
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case Position.Right:
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case Position.Top:
      return { x: rect.x + rect.width / 2, y: rect.y };
    case Position.Bottom:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    default:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }
}

/**
 * Anchor 12px outside the node boundary — same geometry used when rendering (edge tip 12px).
 */
export function anchorOutsideBoundary(
  rect: HandlerRect,
  side: Position,
  gap: number = HANDLER_ENDPOINT_GAP,
): { x: number; y: number } {
  switch (side) {
    case Position.Left:
      return { x: rect.x - gap, y: rect.y + rect.height / 2 };
    case Position.Right:
      return { x: rect.x + rect.width + gap, y: rect.y + rect.height / 2 };
    case Position.Top:
      return { x: rect.x + rect.width / 2, y: rect.y - gap };
    case Position.Bottom:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height + gap };
    default:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height + gap };
  }
}

/**
 * Returns the outward direction vector for a side.
 */
export function outwardDirection(side: Position): { dx: number; dy: number } {
  switch (side) {
    case Position.Left:   return { dx: -1, dy: 0 };
    case Position.Right:  return { dx: 1, dy: 0 };
    case Position.Top:    return { dx: 0, dy: -1 };
    case Position.Bottom: return { dx: 0, dy: 1 };
    default:              return { dx: 0, dy: 1 };
  }
}

/**
 * Default orthogonal waypoints for a handler pair (Z or L), matching
 * computeDirectWaypoints in edgeRouteBuilder — no collision detours.
 */
export function buildDefaultOrthogonalWaypoints(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourceSide: Position,
  targetSide: Position,
  edgeOffset: number = 0,
): Array<{ x: number; y: number }> {
  const sourceIsH = isHorizontal(sourceSide);
  const targetIsH = isHorizontal(targetSide);

  if (sourceIsH && targetIsH) {
    const mx = (source.x + target.x) / 2 + edgeOffset;
    return [
      { x: source.x, y: source.y },
      { x: mx, y: source.y },
      { x: mx, y: target.y },
      { x: target.x, y: target.y },
    ];
  }
  if (!sourceIsH && !targetIsH) {
    const my = (source.y + target.y) / 2 + edgeOffset;
    return [
      { x: source.x, y: source.y },
      { x: source.x, y: my },
      { x: target.x, y: my },
      { x: target.x, y: target.y },
    ];
  }
  if (sourceIsH) {
    return [
      { x: source.x, y: source.y },
      { x: target.x, y: source.y },
      { x: target.x, y: target.y },
    ];
  }
  return [
    { x: source.x, y: source.y },
    { x: source.x, y: target.y },
    { x: target.x, y: target.y },
  ];
}

/**
 * Estimates bends for a path between two handlers.
 *   H→H / V→V: 2 (Z-shape); H→V / V→H: 1 (L-shape)
 * Reverse-flow same-orientation pairs add +1 (extra wrap).
 */
function estimateBendCount(
  sourceSide: Position,
  targetSide: Position,
  direction: 'LR' | 'TD',
): number {
  const srcH = isHorizontal(sourceSide);
  const tgtH = isHorizontal(targetSide);
  let bends = srcH === tgtH ? 2 : 1;

  if (srcH === tgtH && sourceSide !== targetSide) {
    if (direction === 'LR' && srcH && sourceSide === Position.Left) {
      bends += 1; // Left→Right reverse wrap
    }
    if (direction === 'TD' && !srcH && sourceSide === Position.Top) {
      bends += 1; // Top→Bottom reverse wrap
    }
  }

  return bends;
}

/**
 * True if any segment of the orthogonal path hits an obstacle.
 */
function orthogonalPathHitsObstacles(
  waypoints: Array<{ x: number; y: number }>,
  obstacleRects: Map<string, HandlerRect> | undefined,
  excludedIds: Set<string>,
): boolean {
  if (!obstacleRects || obstacleRects.size === 0) return false;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    for (const [id, rect] of obstacleRects) {
      if (excludedIds.has(id)) continue;
      if (segmentIntersectsRect(a.x, a.y, b.x, b.y, rect.x, rect.y, rect.width, rect.height)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * True if the default orthogonal path clips the interior of source or target.
 *
 * Endpoints sit 12px outside the node, so a correct Z/L path must never
 * intersect either terminal's interior. Any intersection means the path
 * tunnels through the node to reach a far-side handle — always penalize.
 */
function orthogonalPathEntersTerminal(
  waypoints: Array<{ x: number; y: number }>,
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
): boolean {
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
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, src.x, src.y, src.width, src.height)) {
      return true;
    }
    if (segmentIntersectsRect(a.x, a.y, b.x, b.y, tgt.x, tgt.y, tgt.width, tgt.height)) {
      return true;
    }
  }
  return false;
}

/**
 * Side of `from` that faces toward the center of `to` (nearest / facing handle).
 */
export function facingSideToward(
  from: HandlerRect,
  to: HandlerRect,
): Position {
  const fromCX = from.x + from.width / 2;
  const fromCY = from.y + from.height / 2;
  const toCX = to.x + to.width / 2;
  const toCY = to.y + to.height / 2;
  const dx = toCX - fromCX;
  const dy = toCY - fromCY;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return Position.Right;
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? Position.Bottom : Position.Top;
  }
  return dx > 0 ? Position.Right : Position.Left;
}

/**
 * Prefer the geometrically nearest / facing handlers.
 * Strong enough to beat bend+directional preference for L-shapes that
 * wrap to far sides, but far below the collision penalty (1000).
 */
function facingPenalty(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  sourceSide: Position,
  targetSide: Position,
): number {
  const idealSource = facingSideToward(sourceRect, targetRect);
  const idealTarget = facingSideToward(targetRect, sourceRect);
  let penalty = 0;
  if (sourceSide !== idealSource) penalty += 30;
  if (targetSide !== idealTarget) penalty += 30;
  return penalty;
}

/**
 * Soft layout-flow preference (secondary to facing / obstacles).
 */
function directionalPenalty(
  pair: HandlerPair,
  direction: 'LR' | 'TD',
): number {
  const { sourceSide, targetSide } = pair;

  const isSourceH = isHorizontal(sourceSide);
  const isTargetH = isHorizontal(targetSide);

  if (isSourceH === isTargetH) {
    if (sourceSide === targetSide) {
      return 20; // Same side — S-shape
    }
    if (direction === 'LR') {
      if (isSourceH) {
        return sourceSide === Position.Right ? 0 : 12;
      }
      return 4;
    }
    if (!isSourceH) {
      return sourceSide === Position.Bottom ? 0 : 12;
    }
    return 4;
  }

  return 8; // Mixed — L-shape
}

/**
 * Scores all 16 possible handler pairs and returns them sorted by score
 * (best first). Collision is evaluated on the default orthogonal path,
 * matching what the router draws before detours.
 */
export function scoreAllHandlerPairs(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  direction: 'LR' | 'TD' = 'LR',
  obstacleRects?: Map<string, HandlerRect>,
  excludedIds?: Set<string>,
  horizontalOnly?: boolean,
): HandlerPairScore[] {
  const scores: HandlerPairScore[] = [];
  const excl = excludedIds ?? new Set<string>();
  const allowed = getAllowedSides(horizontalOnly);

  for (const srcSide of allowed) {
    for (const tgtSide of allowed) {
      const srcAnchor = anchorOutsideBoundary(sourceRect, srcSide);
      const tgtAnchor = anchorOutsideBoundary(targetRect, tgtSide);
      const waypoints = buildDefaultOrthogonalWaypoints(
        srcAnchor, tgtAnchor, srcSide, tgtSide,
      );

      const distance =
        Math.abs(srcAnchor.x - tgtAnchor.x) + Math.abs(srcAnchor.y - tgtAnchor.y);
      const bends = estimateBendCount(srcSide, tgtSide, direction);

      const collides = orthogonalPathHitsObstacles(waypoints, obstacleRects, excl);
      const terminal = orthogonalPathEntersTerminal(waypoints, sourceRect, targetRect);
      const dirPenalty = directionalPenalty(
        { sourceSide: srcSide, targetSide: tgtSide },
        direction,
      );
      const facePenalty = facingPenalty(sourceRect, targetRect, srcSide, tgtSide);

      // Terminal penetration is as bad as hitting another node — otherwise a
      // short path that tunnels through source/target can beat a clean detour.
      const total =
        distance * 0.005 +
        bends * 8 +
        (collides ? 1000 : 0) +
        dirPenalty +
        facePenalty +
        (terminal ? 1000 : 0);

      scores.push({
        pair: { sourceSide: srcSide, targetSide: tgtSide },
        total,
        distance,
        bends,
        collides,
        directional: dirPenalty === 0,
        terminal,
      });
    }
  }

  scores.sort((a, b) => a.total - b.total);
  return scores;
}

/**
 * Selects the best handler pair for an edge.
 *
 * Priority:
 *   1. Manual overrides (both sides) → bypass scoring
 *   2. Partial manual → filter candidates then pick best
 *   3. Lane preferences → -50 bias, scoring still runs (cannot beat collision)
 *   4. Pure scoring → all 16 pairs, best wins
 */
export function selectBestHandlerPair(
  sourceRect: HandlerRect,
  targetRect: HandlerRect,
  direction: 'LR' | 'TD' = 'LR',
  obstacleRects?: Map<string, HandlerRect>,
  excludedIds?: Set<string>,
  manualSourceSide?: Position,
  manualTargetSide?: Position,
  laneSourcePreference?: Position,
  laneTargetPreference?: Position,
  horizontalOnly?: boolean,
): HandlerPair {
  // Clamp manual / lane vertical sides to horizontal when the toggle is on – they are invalid in that mode.
  const effManualSource = clampToHorizontal(manualSourceSide, horizontalOnly);
  const effManualTarget = clampToHorizontal(manualTargetSide, horizontalOnly);
  const effLaneSource = clampToHorizontal(laneSourcePreference, horizontalOnly);
  const effLaneTarget = clampToHorizontal(laneTargetPreference, horizontalOnly);

  if (effManualSource !== undefined && effManualTarget !== undefined) {
    if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
      logger.debug('[EdgeDebug:3-Override] FULL BYPASS — both manual: src=%s tgt=%s',
        effManualSource, effManualTarget);
    }
    return { sourceSide: effManualSource, targetSide: effManualTarget };
  }
  if (effManualSource !== undefined || effManualTarget !== undefined) {
    const scores = scoreAllHandlerPairs(
      sourceRect, targetRect, direction, obstacleRects, excludedIds, horizontalOnly,
    );
    const filtered = scores.filter(s => {
      if (effManualSource !== undefined && s.pair.sourceSide !== effManualSource) return false;
      if (effManualTarget !== undefined && s.pair.targetSide !== effManualTarget) return false;
      return true;
    });
    if (filtered.length > 0) {
      if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
        logger.debug('[EdgeDebug:3-Override] PARTIAL BYPASS — src=%s tgt=%s  winner=%s→%s score=%.2f',
          effManualSource ?? '*',
          effManualTarget ?? '*',
          filtered[0].pair.sourceSide, filtered[0].pair.targetSide,
          filtered[0].total);
      }
      return filtered[0].pair;
    }
  }

  const LANE_BIAS = -50;
  const hasLanePrefs = effLaneSource !== undefined || effLaneTarget !== undefined;

  const scores = scoreAllHandlerPairs(
    sourceRect, targetRect, direction, obstacleRects, excludedIds, horizontalOnly,
  );

  if (hasLanePrefs) {
    for (const s of scores) {
      if (effLaneSource !== undefined && s.pair.sourceSide === effLaneSource) {
        s.total += LANE_BIAS;
      }
      if (effLaneTarget !== undefined && s.pair.targetSide === effLaneTarget) {
        s.total += LANE_BIAS;
      }
    }
    scores.sort((a, b) => a.total - b.total);
  }

  if (process.env.NEXT_PUBLIC_DEBUG_EDGES === 'true') {
    const top5 = scores.slice(0, 5);
    logger.table(top5.map(s => ({
      pair: `${s.pair.sourceSide}→${s.pair.targetSide}`,
      total: +s.total.toFixed(2),
      distance: s.distance,
      bends: s.bends,
      collides: s.collides,
      terminal: s.terminal,
      directional: s.directional,
    })));
    const collisions = scores.filter(s => s.collides);
    const terminals = scores.filter(s => s.terminal);
    if (collisions.length > 0) {
      logger.debug('[EdgeDebug:2-Scorer] %d pairs disqualified by collision', collisions.length);
    }
    if (terminals.length > 0) {
      logger.debug('[EdgeDebug:2-Scorer] %d pairs hit terminal penalty', terminals.length);
    }
    if (hasLanePrefs) {
      logger.debug('[EdgeDebug:2-Scorer] lane prefs applied: src=%s tgt=%s (bias=%d)',
        laneSourcePreference ?? '*',
        laneTargetPreference ?? '*',
        LANE_BIAS);
    }
    logger.debug('[EdgeDebug:2-Scorer] WINNER: %s→%s  score=%.2f',
      scores[0].pair.sourceSide, scores[0].pair.targetSide, scores[0].total);
  }

  return scores[0].pair;
}
