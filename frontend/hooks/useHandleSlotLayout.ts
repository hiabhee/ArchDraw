'use client';

import { useMemo } from 'react';
import { Position, type Node } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import {
  getCenteredSides,
  resolveSideFromEdgeHandles,
  type EdgeSideResolver,
} from '@/lib/utils/simpleFloatingEdge';
import {
  computeDynamicSlotOffsets,
  type DynamicSlotOffsets,
} from '@/lib/utils/handleSlotOrder';

const HANDLE_TRANSITION =
  'top 0.2s ease, left 0.2s ease, right 0.2s ease, bottom 0.2s ease, transform 0.2s ease';

function buildNodePositions(
  nodes: Node[],
): Map<string, { x: number; y: number; width: number; height: number }> {
  const map = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const n of nodes) {
    const x = n.positionAbsolute?.x ?? n.position.x;
    const y = n.positionAbsolute?.y ?? n.position.y;
    map.set(n.id, {
      x,
      y,
      width: n.width ?? (n.data as { nodeWidth?: number })?.nodeWidth ?? 180,
      height: n.height ?? (n.data as { nodeHeight?: number })?.nodeHeight ?? 70,
    });
  }
  return map;
}

/**
 * Per-side handle slot layout for a node.
 * When only incoming OR only outgoing edges use a side, that handle is centered
 * (offset 0) so edges attach flush without crossing the paired slot.
 *
 * When both directions exist on a side, the slot ordering is derived
 * dynamically from the relative positions of connected nodes.
 */
export function useHandleSlotLayout(nodeId?: string) {
  const edges = useDiagramStore((s) => s.edges);
  const nodes = useDiagramStore((s) => s.nodes);

  const nodePositions = useMemo(() => buildNodePositions(nodes), [nodes]);

  const centeredSides = useMemo(() => {
    if (!nodeId) return new Set<Position>();
    const resolveSide: EdgeSideResolver = (edge, nid) =>
      resolveSideFromEdgeHandles(edge, nid) ?? Position.Right;
    return getCenteredSides(nodeId, edges, resolveSide);
  }, [nodeId, edges]);

  const dynamicOffsets = useMemo(() => {
    if (!nodeId) return new Map<Position, DynamicSlotOffsets>();
    const map = new Map<Position, DynamicSlotOffsets>();
    const sides: Position[] = [
      Position.Left,
      Position.Right,
      Position.Top,
      Position.Bottom,
    ];
    for (const side of sides) {
      map.set(side, computeDynamicSlotOffsets(nodeId, side, edges, nodePositions));
    }
    return map;
  }, [nodeId, edges, nodePositions]);

  const getSlotOffset = (side: Position, type: 'source' | 'target') => {
    if (centeredSides.has(side)) return 0;
    const offsets = dynamicOffsets.get(side);
    if (!offsets || offsets.centered) return 0;
    return type === 'source' ? offsets.outgoingOffset : offsets.incomingOffset;
  };

  return { centeredSides, getSlotOffset, handleTransition: HANDLE_TRANSITION };
}
