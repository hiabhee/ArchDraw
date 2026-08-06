import type { Edge, Node } from 'reactflow';
import { MarkerType, Position } from 'reactflow';
import { getObstacleAwareHandles } from '@/lib/features/dynamicHandles';
import { processEdgeManagement } from '@/lib/features/edgeManagement';
import { mergeParallelEdges } from '@/lib/utils/mergeParallelEdges';
import { migrateEdgesToSmoothstep } from '@/lib/utils/edgeMigration';
import { hasReverseEdge, resolveBidirectionalFacingSides } from '@/lib/utils/handleSlotOrder';
import { EDGE_CONFIG } from '@/lib/config';
import { KNOWN_EDGE_TYPES, DEFAULT_EDGE_TYPE } from '../constants';

export function normalizeEdge(edge: Edge): Edge {
  const legacyTypes = new Set(['simpleFloating', 'floating', 'default']);
  const resolvedType =
    edge.type && legacyTypes.has(edge.type) ? DEFAULT_EDGE_TYPE : edge.type;
  const finalType =
    resolvedType && KNOWN_EDGE_TYPES.has(resolvedType) ? resolvedType : DEFAULT_EDGE_TYPE;
  const edgeData = (edge.data as Record<string, unknown> | undefined) ?? {};
  return {
    ...edge,
    type: finalType,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    data: {
      ...edgeData,
      pathType: (edgeData.pathType as string | undefined) || 'Smoothstep',
    },
    markerEnd: edge.markerEnd ?? {
      type: EDGE_CONFIG.markerType,
      color: EDGE_CONFIG.strokeColor,
      width: 20,
      height: 20,
    },
  };
}

export function positionToSide(pos: Position): string {
  if (pos === Position.Left) return 'left';
  if (pos === Position.Right) return 'right';
  if (pos === Position.Top) return 'top';
  return 'bottom';
}

export function getAbsolutePosition(node: Node, nodes: Node[]): { x: number; y: number } {
  let x = node.position?.x ?? 0;
  let y = node.position?.y ?? 0;
  let current = node;
  const visited = new Set<string>([node.id]);
  while (current.parentId || (current as { parentNode?: string }).parentNode) {
    const pId = current.parentId || (current as { parentNode?: string }).parentNode;
    if (!pId || visited.has(pId)) break;
    visited.add(pId);
    const parent = nodes.find((n) => n.id === pId);
    if (!parent || !parent.position) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

export function normalizeEdges(edges: Edge[]): Edge[] {
  const migrated = migrateEdgesToSmoothstep(edges);

  const seenIds = new Set<string>();
  const deduplicated = migrated.map((edge) => {
    let id = edge.id;
    while (seenIds.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 8)}`;
    }
    seenIds.add(id);
    return { ...edge, id };
  });

  return mergeParallelEdges(deduplicated.map(normalizeEdge));
}

export function sanitizeEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    const stroke = edge.style?.stroke || '#94a3b8';
    return {
      ...edge,
      type: edge.type || DEFAULT_EDGE_TYPE,
      markerEnd: edge.markerEnd || {
        type: MarkerType.ArrowClosed,
        color: typeof stroke === 'string' ? stroke : '#94a3b8',
      },
      style: {
        strokeWidth: 1.5,
        stroke,
        ...edge.style,
      },
    };
  });
}

function nodeRectForEdge(node: Node, nodes: Node[]) {
  const pos = getAbsolutePosition(node, nodes);
  const w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? 180;
  const h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? 70;
  return { x: pos.x, y: pos.y, width: w, height: h };
}

/**
 * Bidirectional pairs must use facing sides and auto-routing only.
 * Stale customWaypoints (e.g. from old double-click bend insertion) cause
 * crossed "eye" paths that ignore lane offsets.
 */
export function applyBidirectionalEdgeFixes(edges: Edge[], nodes: Node[]): Edge[] {
  return edges.map((edge) => {
    if (edge.source === edge.target || !hasReverseEdge(edge, edges)) {
      return edge;
    }

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const sourceRect = nodeRectForEdge(sourceNode, nodes);
    const targetRect = nodeRectForEdge(targetNode, nodes);
    const facing = resolveBidirectionalFacingSides(edge, edges, sourceRect, targetRect);
    if (!facing) return edge;

    const prior = (edge.data as Record<string, unknown> | undefined) ?? {};
    const { customWaypoints: _removed, ...rest } = prior;

    return {
      ...edge,
      sourceHandle: `source-${positionToSide(facing.sourceSide)}`,
      targetHandle: `target-${positionToSide(facing.targetSide)}`,
      data: Object.keys(rest).length > 0 ? rest : undefined,
      type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : DEFAULT_EDGE_TYPE,
    };
  });
}

export function distributeTargetHandles(
  nodes: Node[],
  edges: Edge[],
  activeLayoutPresetId: string = 'layered-lr'
): Edge[] {
  const { edges: managedEdges } = processEdgeManagement(nodes, edges);
  const normalized = normalizeEdges(managedEdges);
  const direction = activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR';

  return applyBidirectionalEdgeFixes(
    normalized.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);

    if (!sourceNode) return edge;

    if (edge.source === edge.target) {
      return {
        ...edge,
        sourceHandle: 'source-top',
        targetHandle: 'target-right',
        type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : DEFAULT_EDGE_TYPE,
      };
    }

    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!targetNode) {
      return {
        ...edge,
        sourceHandle: null,
        targetHandle: null,
        type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : DEFAULT_EDGE_TYPE,
      };
    }

    const sPos = getAbsolutePosition(sourceNode, nodes);
    const tPos = getAbsolutePosition(targetNode, nodes);

    const sWidth = sourceNode.width ?? (sourceNode.data as { nodeWidth?: number })?.nodeWidth ?? 180;
    const sHeight = sourceNode.height ?? (sourceNode.data as { nodeHeight?: number })?.nodeHeight ?? 70;
    const tWidth = targetNode.width ?? (targetNode.data as { nodeWidth?: number })?.nodeWidth ?? 180;
    const tHeight = targetNode.height ?? (targetNode.data as { nodeHeight?: number })?.nodeHeight ?? 70;

    const sourceRect = { x: sPos.x, y: sPos.y, width: sWidth, height: sHeight };
    const targetRect = { x: tPos.x, y: tPos.y, width: tWidth, height: tHeight };

    const intermediateNodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    const excludedIds = new Set([edge.source, edge.target]);

    for (const node of nodes) {
      if (excludedIds.has(node.id)) continue;
      const isGroup =
        node.type === 'groupNode' ||
        node.type === 'frameNode' ||
        node.type === 'group' ||
        node.type === 'demoGroup' ||
        (node.data as { isGroup?: boolean })?.isGroup === true;
      if (isGroup) continue;

      const pos = getAbsolutePosition(node, nodes);
      const w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? 180;
      const h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? 70;
      intermediateNodeRects.set(node.id, { id: node.id, x: pos.x, y: pos.y, w, h });
    }

    const handles = getObstacleAwareHandles(
      sourceRect,
      targetRect,
      intermediateNodeRects.size > 0 ? intermediateNodeRects : undefined,
      excludedIds,
      edge.id,
      edge.source,
      edge.target,
      edge.data,
      sourceNode.data?.serviceType,
      targetNode.data?.serviceType,
      direction
    );

    return {
      ...edge,
      sourceHandle: `source-${positionToSide(handles.sourcePosition)}`,
      targetHandle: `target-${positionToSide(handles.targetPosition)}`,
      type: edge.type && KNOWN_EDGE_TYPES.has(edge.type) ? edge.type : DEFAULT_EDGE_TYPE,
    };
  }),
    nodes,
  );
}
