'use client';

import { useMemo } from 'react';
import { Position, type Node, type Edge } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import {
  computeDynamicSlotOffsets,
  type DynamicSlotOffsets,
} from '@/lib/utils/handleSlotOrder';

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

function resolveSimpleSide(
  edge: Edge,
  nodeId: string,
  nodes: Node[],
): Position | undefined {
  const data = edge.data as Record<string, unknown> | undefined;
  // Manual / lane overrides pin the side.
  if (edge.source === nodeId) {
    const manual = sideFromDataString(data?.sourceSide);
    if (manual !== undefined) return manual;
    const lane = sideFromDataString(data?.laneSourceSide);
    if (lane !== undefined) return lane;
    const handleSide = sideFromDataString((edge as unknown as { sourceHandle?: string }).sourceHandle?.split('-').pop());
    if (handleSide) return handleSide;
  } else if (edge.target === nodeId) {
    const manual = sideFromDataString(data?.targetSide);
    if (manual !== undefined) return manual;
    const lane = sideFromDataString(data?.laneTargetSide);
    if (lane !== undefined) return lane;
    const handleSide = sideFromDataString((edge as unknown as { targetHandle?: string }).targetHandle?.split('-').pop());
    if (handleSide) return handleSide;
  } else {
    return undefined;
  }

  // Simple center-to-center geometry — predictable, matches getSimpleEdgePositions.
  // This is used for handle visibility (which sides have edges), not for final edge routing.
  const selfNode = nodes.find((n) => n.id === nodeId);
  const otherNode = nodes.find((n) => n.id === (edge.source === nodeId ? edge.target : edge.source));
  if (!selfNode || !otherNode) return undefined;
  const selfPos = getAbsolutePosition(selfNode, nodes);
  const otherPos = getAbsolutePosition(otherNode, nodes);
  const selfDims = getEffectiveNodeDimensions(selfNode);
  const otherDims = getEffectiveNodeDimensions(otherNode);
  const selfCx = selfPos.x + selfDims.width / 2;
  const selfCy = selfPos.y + selfDims.height / 2;
  const otherCx = otherPos.x + otherDims.width / 2;
  const otherCy = otherPos.y + otherDims.height / 2;
  const dx = otherCx - selfCx;
  const dy = otherCy - selfCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

function buildNodePositions(
  nodes: Node[],
): Map<string, { x: number; y: number; width: number; height: number }> {
  const map = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const n of nodes) {
    const pos = getAbsolutePosition(n, nodes);
    const { width, height } = getEffectiveNodeDimensions(n);
    map.set(n.id, { x: pos.x, y: pos.y, width, height });
  }
  return map;
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
 * Strict visibility: empty sides show one handle per side (centered, both
 * types overlapping visually as one); only outgoing shows only source;
 * only incoming shows only target; both shows two offset ±16.
 */
export function useHandleSlotLayout(nodeId?: string) {
  const edges = useDiagramStore((s) => s.edges);
  const nodes = useDiagramStore((s) => s.nodes);

  const nodePositions = useMemo(() => buildNodePositions(nodes), [nodes]);

  // Scorer side for each incident edge, memoized per node.
  const incidentEdges = useMemo(
    () => (nodeId ? edges.filter((e) => e.source === nodeId || e.target === nodeId) : []),
    [edges, nodeId],
  );

  const edgeSideCache = useMemo(() => {
    if (!nodeId) return new Map<string, Position>();
    const cache = new Map<string, Position>();
    for (const edge of incidentEdges) {
      const side = resolveSimpleSide(edge, nodeId, nodes);
      if (side) cache.set(edge.id, side);
    }
    return cache;
  }, [incidentEdges, nodeId, nodes]);

  const sidePresence = useMemo(() => {
    const map = new Map<Position, { hasIncoming: boolean; hasOutgoing: boolean }>();
    for (const side of SIDES) map.set(side, { hasIncoming: false, hasOutgoing: false });
    for (const edge of incidentEdges) {
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
      map.set(side, computeDynamicSlotOffsets(nodeId, side, edges, nodePositions, resolver as unknown as (edge: Edge, nodeId: string) => Position | undefined));
    }
    return map;
  }, [nodeId, edges, nodePositions, edgeSideCache]);

  const getSlotOffset = (side: Position, type: 'source' | 'target') => {
    if (centeredSides.has(side)) return 0;
    const offsets = dynamicOffsets.get(side);
    if (!offsets || offsets.centered) return 0;
    return type === 'source' ? offsets.outgoingOffset : offsets.incomingOffset;
  };

  const shouldRenderHandle = (side: Position, type: 'source' | 'target'): boolean => {
    const presence = sidePresence.get(side);
    if (!presence) return false;
    const { hasIncoming, hasOutgoing } = presence;
    // Empty side: show one centered handle (source) for creation affordance, not two overlapping.
    // Single-direction sides show only that type, centered. Both directions show two offset handles.
    if (!hasIncoming && !hasOutgoing) return type === 'source';
    return type === 'source' ? hasOutgoing : hasIncoming;
  };

  return { centeredSides, sidePresence, getSlotOffset, shouldRenderHandle, handleTransition: HANDLE_TRANSITION };
}
