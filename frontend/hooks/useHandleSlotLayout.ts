'use client';

import { useMemo } from 'react';
import { Position, type Node, type Edge } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import {
  computeDynamicSlotOffsets,
  INCOMING_OUTGOING_GAP,
  resolveBidirectionalFacingSides,
  type DynamicSlotOffsets,
} from '@/lib/utils/handleSlotOrder';
import {
  selectBestHandlerPair,
  scoreAllHandlerPairs,
  buildDefaultOrthogonalWaypoints,
  anchorOutsideBoundary,
  type HandlerRect,
} from '@/lib/utils/handlerPairScorer';
import { segmentIntersectsRect } from '@/lib/utils/collisionFreeEdgePath';

const HANDLE_TRANSITION =
  'top 0.2s ease, left 0.2s ease, right 0.2s ease, bottom 0.2s ease, transform 0.2s ease';

const SIDES: Position[] = [Position.Left, Position.Right, Position.Top, Position.Bottom];

/* ── helpers matching edgeRouteBuilder geometry ── */

function sideFromDataString(value: unknown): Position | undefined {
  if (value === 'left' || value === Position.Left) return Position.Left;
  if (value === 'right' || value === Position.Right) return Position.Right;
  if (value === 'top' || value === Position.Top) return Position.Top;
  if (value === 'bottom' || value === Position.Bottom) return Position.Bottom;
  return undefined;
}

function getAbsolutePosition(node: Node, nodes: Node[]): { x: number; y: number } {
  let x = node.position?.x ?? 0;
  let y = node.position?.y ?? 0;
  let current: Node | undefined = node;
  const visited = new Set<string>([node.id]);
  while (current && (current.parentId || (current as unknown as { parentNode?: string }).parentNode)) {
    const pId: string | undefined = current.parentId || (current as unknown as { parentNode?: string }).parentNode;
    if (!pId || visited.has(pId)) break;
    visited.add(pId);
    const parent: Node | undefined = nodes.find((n) => n.id === pId);
    if (!parent || !parent.position) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

function getNodeRect(node: Node, nodes: Node[], renderStyleId?: string): HandlerRect {
  const pos = getAbsolutePosition(node, nodes);
  const { width: w, height: h } = getEffectiveNodeDimensions(node, renderStyleId);
  return { x: pos.x, y: pos.y, width: w, height: h };
}

function isGroupNode(node: Node): boolean {
  return (
    node.type === 'groupNode' ||
    node.type === 'frameNode' ||
    node.type === 'group' ||
    node.type === 'demoGroup' ||
    (node.data as { isGroup?: boolean } | undefined)?.isGroup === true
  );
}

function getAncestorGroupIds(nodeId: string, nodes: Node[]): Set<string> {
  const result = new Set<string>();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let current: Node | undefined = nodeById.get(nodeId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const parentId = current.parentId || (current as unknown as { parentNode?: string }).parentNode;
    if (!parentId) break;
    const parent = nodeById.get(parentId);
    if (!parent) break;
    if (isGroupNode(parent)) result.add(parentId);
    current = parent;
  }
  return result;
}

function buildScorerObstacles(
  nodes: Node[],
  excludedIds: Set<string>,
  passableGroupIds: Set<string>,
  renderStyleId?: string,
): Map<string, HandlerRect> {
  const map = new Map<string, HandlerRect>();
  for (const node of nodes) {
    if (excludedIds.has(node.id)) continue;
    if (isGroupNode(node) && passableGroupIds.has(node.id)) continue;
    const rect = getNodeRect(node, nodes, renderStyleId);
    map.set(node.id, rect);
  }
  return map;
}

function orthogonalPenetratesTerminalForHandles(
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

function resolveScorerSide(
  edge: Edge,
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TD',
  renderStyleId?: string,
): Position | undefined {
  const data = edge.data as Record<string, unknown> | undefined;
  if (edge.source !== nodeId && edge.target !== nodeId) return undefined;
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return undefined;
  const sourceRect = getNodeRect(sourceNode, nodes, renderStyleId);
  const targetRect = getNodeRect(targetNode, nodes, renderStyleId);
  const bidirectionalSides = resolveBidirectionalFacingSides(edge, edges, sourceRect, targetRect);
  if (bidirectionalSides) {
    return edge.source === nodeId ? bidirectionalSides.sourceSide : bidirectionalSides.targetSide;
  }
  // Explicit manual sides pin; lane sides only bias the scorer.
  // Handle ids do NOT pin sides — floating behavior.
  if (edge.source === nodeId) {
    const manual = sideFromDataString(data?.sourceSide);
    if (manual !== undefined) return manual;
  } else if (edge.target === nodeId) {
    const manual = sideFromDataString(data?.targetSide);
    if (manual !== undefined) return manual;
  } else {
    return undefined;
  }

  const excluded = new Set([edge.source, edge.target]);
  const passableGroupIds = new Set<string>([
    ...getAncestorGroupIds(edge.source, nodes),
    ...getAncestorGroupIds(edge.target, nodes),
  ]);
  const obstacles = buildScorerObstacles(nodes, excluded, passableGroupIds, renderStyleId);

  const manualSource = sideFromDataString(data?.sourceSide);
  const manualTarget = sideFromDataString(data?.targetSide);
  const laneSource = sideFromDataString(data?.laneSourceSide);
  const laneTarget = sideFromDataString(data?.laneTargetSide);

  let pair = selectBestHandlerPair(
    sourceRect,
    targetRect,
    direction,
    obstacles.size > 0 ? obstacles : undefined,
    excluded,
    manualSource,
    manualTarget,
    laneSource,
    laneTarget,
  );

  // Mirror edgeRouteBuilder's terminal-penetration guard so handle side
  // matches the actual rendered side (prevents Chat left single vs Auth right dual).
  const hasUserOverride = manualSource !== undefined && manualTarget !== undefined;
  const usesCustomWaypoints = Array.isArray(data?.customWaypoints) && data.customWaypoints.length > 0;
  if (!hasUserOverride && !usesCustomWaypoints && orthogonalPenetratesTerminalForHandles(sourceRect, targetRect, pair.sourceSide, pair.targetSide)) {
    const allScores = scoreAllHandlerPairs(
      sourceRect,
      targetRect,
      direction,
      obstacles.size > 0 ? obstacles : undefined,
      excluded,
    );
    // Apply lane bias like edgeRouteBuilder (cannot beat collision but influences fallback)
    const LANE_BIAS = -50;
    const hasLane = laneSource !== undefined || laneTarget !== undefined;
    if (hasLane) {
      for (const s of allScores) {
        if (laneSource !== undefined && s.pair.sourceSide === laneSource) s.total += LANE_BIAS;
        if (laneTarget !== undefined && s.pair.targetSide === laneTarget) s.total += LANE_BIAS;
      }
      allScores.sort((a, b) => a.total - b.total);
    }
    // Respect partial manual overrides when filtering fallback candidates
    let filtered = allScores;
    if (manualSource !== undefined || manualTarget !== undefined) {
      filtered = allScores.filter((s) => {
        if (manualSource !== undefined && s.pair.sourceSide !== manualSource) return false;
        if (manualTarget !== undefined && s.pair.targetSide !== manualTarget) return false;
        return true;
      });
    }
    const fallback = filtered.find((s) => {
      if (s.pair.sourceSide === pair.sourceSide && s.pair.targetSide === pair.targetSide) return false;
      return !orthogonalPenetratesTerminalForHandles(sourceRect, targetRect, s.pair.sourceSide, s.pair.targetSide);
    });
    if (fallback) pair = fallback.pair;
  }

  return edge.source === nodeId ? pair.sourceSide : pair.targetSide;
}

function buildNodePositions(
  nodes: Node[],
  renderStyleId?: string,
): Map<string, { x: number; y: number; width: number; height: number }> {
  const map = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const n of nodes) {
    const pos = getAbsolutePosition(n, nodes);
    const { width, height } = getEffectiveNodeDimensions(n, renderStyleId);
    map.set(n.id, { x: pos.x, y: pos.y, width, height });
  }
  return map;
}

const nodePositionCache = new WeakMap<
  Node[],
  Map<string, Map<string, { x: number; y: number; width: number; height: number }>>
>();

function getCachedNodePositions(nodes: Node[], renderStyleId?: string) {
  let byStyle = nodePositionCache.get(nodes);
  if (!byStyle) {
    byStyle = new Map();
    nodePositionCache.set(nodes, byStyle);
  }
  const key = renderStyleId ?? '';
  let positions = byStyle.get(key);
  if (!positions) {
    positions = buildNodePositions(nodes, renderStyleId);
    byStyle.set(key, positions);
  }
  return positions;
}

/**
 * Per-side handle slot layout for a node.
 * Uses the same scorer as edgeRouteBuilder so the counted side for each edge
 * matches the rendered side, keeping handle dots and edge anchors aligned.
 *
 * When only incoming OR only outgoing edges use a side, that handle is
 * centered (offset 0). When both directions exist on a side, ordering is
 * derived from relative positions of connected nodes.
 *
 * Strict visibility: empty sides reveal one source affordance on hover or selection;
 * only outgoing shows only source;
 * only incoming shows only target; both shows two offset ±16.
 */
export function useHandleSlotLayout(nodeId?: string) {
  const edges = useDiagramStore((s) => s.edges);
  const nodes = useDiagramStore((s) => s.nodes);
  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);
  const renderStyleId = useDiagramStore((s) => s.diagramRenderStyle);
  const direction: 'LR' | 'TD' = activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR';

  // Every node owns a handle hook. Share the diagram geometry map across those
  // hooks so a drag rebuilds it once, instead of once per node.
  const nodePositions = useMemo(() => getCachedNodePositions(nodes, renderStyleId), [nodes, renderStyleId]);

  // Scorer side for each incident edge, memoized per node — same scorer as edgeRouteBuilder.
  const incidentEdges = useMemo(
    () => (nodeId ? edges.filter((e) => e.source === nodeId || e.target === nodeId) : []),
    [edges, nodeId],
  );

  const edgeSideCache = useMemo(() => {
    if (!nodeId) return new Map<string, Position>();
    const cache = new Map<string, Position>();
    for (const edge of incidentEdges) {
      const side = resolveScorerSide(edge, nodeId, nodes, edges, direction, renderStyleId);
      if (side) cache.set(edge.id, side);
    }
    return cache;
  }, [incidentEdges, nodeId, nodes, edges, direction, renderStyleId]);

  const sidePresence = useMemo(() => {
    const map = new Map<Position, { hasIncoming: boolean; hasOutgoing: boolean }>();
    for (const side of SIDES) map.set(side, { hasIncoming: false, hasOutgoing: false });
    for (const edge of incidentEdges) {
      if (edge.source === nodeId && edge.target === nodeId) {
        const data = edge.data as { selfLoopStyle?: string; loopVariant?: string } | undefined;
        const sourceSide = data?.selfLoopStyle === 'corner' || data?.loopVariant === 'corner' ||
          data?.selfLoopStyle === 'arc' || data?.loopVariant === 'arc'
          ? Position.Top : Position.Left;
        map.get(sourceSide)!.hasOutgoing = true;
        map.get(Position.Right)!.hasIncoming = true;
        continue;
      }
      const side = edgeSideCache.get(edge.id);
      if (!side) continue;
      const entry = map.get(side)!;
      if (edge.target === nodeId) entry.hasIncoming = true;
      else entry.hasOutgoing = true;
    }
    return map;
  }, [incidentEdges, edgeSideCache, nodeId]);

  const centeredSides = useMemo(() => {
    const set = new Set<Position>();
    for (const [side, { hasIncoming, hasOutgoing }] of sidePresence.entries()) {
      if (!(hasIncoming && hasOutgoing)) set.add(side);
    }
    return set;
  }, [sidePresence]);

  const dynamicOffsets = useMemo(() => {
    if (!nodeId) return new Map<Position, DynamicSlotOffsets>();
    const map = new Map<Position, DynamicSlotOffsets>();
    // Resolver that returns scorer side for incident edges, undefined otherwise
    const resolver = (edge: Edge, nid: string): Position | undefined => {
      if (nid !== nodeId) return undefined;
      if (edge.source !== nodeId && edge.target !== nodeId) return undefined;
      return edgeSideCache.get(edge.id);
    };
    for (const side of SIDES) {
      map.set(side, computeDynamicSlotOffsets(nodeId, side, incidentEdges, nodePositions, resolver as unknown as (edge: Edge, nodeId: string) => Position | undefined));
    }
    return map;
  }, [nodeId, incidentEdges, nodePositions, edgeSideCache]);

  const getSlotOffset = (side: Position, type: 'source' | 'target') => {
    if (centeredSides.has(side)) return 0;
    const offsets = dynamicOffsets.get(side);
    if (!offsets || offsets.centered) return type === 'source' ? -INCOMING_OUTGOING_GAP : INCOMING_OUTGOING_GAP;
    return type === 'source' ? offsets.outgoingOffset : offsets.incomingOffset;
  };

  const shouldRenderHandle = (side: Position, type: 'source' | 'target'): boolean => {
    const presence = sidePresence.get(side);
    if (!presence) return false;
    const { hasIncoming, hasOutgoing } = presence;
    // Empty side: keep both mounted, but reveal only the source on hover/selection.
    // Single-direction → only that type centered. Both → two offset ±16.
    if (!hasIncoming && !hasOutgoing) return false;
    return type === 'source' ? hasOutgoing : hasIncoming;
  };

  const isEmptySide = (side: Position) => {
    const presence = sidePresence.get(side);
    return !!presence && !presence.hasIncoming && !presence.hasOutgoing;
  };

  return { centeredSides, sidePresence, dynamicOffsets, getSlotOffset, shouldRenderHandle, isEmptySide, handleTransition: HANDLE_TRANSITION };
}
