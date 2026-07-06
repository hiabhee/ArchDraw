import { Edge, Node, Position } from 'reactflow';
import { getObstacleAwareHandles } from '../features/dynamicHandles';
import { getEdgeShiftOffset, getSimpleHandlePosition } from './simpleFloatingEdge';
import { getCollisionFreeWaypoints, segmentIntersectsRect, buildSmoothStepSvg, getCollisionFreeSmoothStepPath } from './collisionFreeEdgePath';
import type { NodeRect } from './collisionFreeEdgePath';
import { useDiagramStore } from '@/store/diagramStore';
import type { EdgeData } from '@/data/edgeTypes';

export interface EdgeRouteResult {
  sourcePosition: Position;
  targetPosition: Position;
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
  waypoints: Array<{ x: number; y: number }>;
  svgPath: string;
}

export function computeEdgeRoute(
  edge: Edge,
  nodes: Node[],
  edges: Edge[]
): EdgeRouteResult {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  const defaultResult = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourcePoint: { x: 0, y: 0 },
    targetPoint: { x: 0, y: 0 },
    waypoints: [],
    svgPath: '',
  };

  if (!sourceNode || !targetNode) {
    return defaultResult;
  }

  // 1. Get absolute positions (respecting parents)
  const getAbsolutePosition = (node: Node) => {
    let x = node.position?.x ?? 0;
    let y = node.position?.y ?? 0;
    let current = node;
    const visited = new Set<string>([node.id]);
    while (current.parentId || (current as any).parentNode) {
      const pId = current.parentId || (current as any).parentNode;
      if (!pId || visited.has(pId)) break;
      visited.add(pId);
      const parent = nodes.find(n => n.id === pId);
      if (!parent || !parent.position) break;
      x += parent.position.x;
      y += parent.position.y;
      current = parent;
    }
    return { x, y };
  };

  const sPos = getAbsolutePosition(sourceNode);
  const tPos = getAbsolutePosition(targetNode);

  // 2. Node sizes
  const sWidth = sourceNode.width ?? (sourceNode as any).measured?.width ?? (sourceNode.data as any)?.nodeWidth ?? 160;
  const sHeight = sourceNode.height ?? (sourceNode as any).measured?.height ?? (sourceNode.data as any)?.nodeHeight ?? 80;
  const tWidth = targetNode.width ?? (targetNode as any).measured?.width ?? (targetNode.data as any)?.nodeWidth ?? 160;
  const tHeight = targetNode.height ?? (targetNode as any).measured?.height ?? (targetNode.data as any)?.nodeHeight ?? 80;

  const sourceRect = { x: sPos.x, y: sPos.y, width: sWidth, height: sHeight };
  const targetRect = { x: tPos.x, y: tPos.y, width: tWidth, height: tHeight };

  // 3. Build intermediate nodes map for obstacle routing (excluding parent containers)
  const nodeInternals = new Map(nodes.map(n => [n.id, n]));
  const excludedIds = new Set([edge.source, edge.target]);
  const nodeRects = new Map<string, NodeRect>();

  for (const [nid, node] of nodeInternals) {
    if (excludedIds.has(nid)) continue;
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      node.type === 'demoGroup' ||
      (node.data as any)?.isGroup === true;
    if (isGroup) continue;

    const pos = getAbsolutePosition(node);
    const w = node.width ?? (node as any).measured?.width ?? (node.data as any)?.nodeWidth ?? 200;
    const h = node.height ?? (node as any).measured?.height ?? (node.data as any)?.nodeHeight ?? 80;
    nodeRects.set(nid, { id: nid, x: pos.x, y: pos.y, w, h });
  }

  const nodeRectParam = nodeRects.size > 0 ? nodeRects : undefined;

  // 4. Resolve handle positions (sides) — geometry first, semantics second
  const edgeData = edge.data as Record<string, unknown> | undefined;
  let sourcePosition: Position;
  let targetPosition: Position;

  const laneSourceSide = edgeData?.laneSourceSide as string | undefined;
  const laneTargetSide = edgeData?.laneTargetSide as string | undefined;

  // Compute normal handles first, then override with lane assignments if present.
  // This ensures that when only one endpoint is a lane node, the other side
  // still uses a geometrically sensible handle rather than defaulting to Bottom.
  const sHandle = edge.sourceHandle;
  const tHandle = edge.targetHandle;
  const hasStoredHandles = sHandle && tHandle && sHandle.startsWith('source-') && tHandle.startsWith('target-');

  if (edge.source === edge.target) {
    sourcePosition = Position.Top;
    targetPosition = Position.Right;
  } else if (hasStoredHandles) {
    const sSide = sHandle.split('-')[1];
    const tSide = tHandle.split('-')[1];
    sourcePosition = sSide === 'left' ? Position.Left : sSide === 'right' ? Position.Right : sSide === 'top' ? Position.Top : Position.Bottom;
    targetPosition = tSide === 'left' ? Position.Left : tSide === 'right' ? Position.Right : tSide === 'top' ? Position.Top : Position.Bottom;
  } else {
    const activePreset = useDiagramStore.getState().activeLayoutPresetId;
    const direction = activePreset === 'layered-tb' ? 'TD' : 'LR';

    const handles = getObstacleAwareHandles(
      sourceRect,
      targetRect,
      nodeRectParam,
      excludedIds,
      edge.id,
      edge.source,
      edge.target,
      edge.data,
      sourceNode.data?.serviceType,
      targetNode.data?.serviceType,
      direction
    );
    sourcePosition = handles.sourcePosition;
    targetPosition = handles.targetPosition;
  }

  // Override with lane assignments where present (only the lane node's side is
  // overridden; the other side keeps the geometrically computed handle).
  if (laneSourceSide) {
    sourcePosition = laneSourceSide === 'left' ? Position.Left : laneSourceSide === 'right' ? Position.Right : laneSourceSide === 'top' ? Position.Top : Position.Bottom;
  }
  if (laneTargetSide) {
    targetPosition = laneTargetSide === 'left' ? Position.Left : laneTargetSide === 'right' ? Position.Right : laneTargetSide === 'top' ? Position.Top : Position.Bottom;
  }

  // 5. Shift offsets for parallel routing
  const sourceShift = getEdgeShiftOffset(edge.source, edge.id, sourcePosition, edges, nodeInternals, 12, nodeRectParam, excludedIds);
  const targetShift = getEdgeShiftOffset(edge.target, edge.id, targetPosition, edges, nodeInternals, 12, nodeRectParam, excludedIds);

  const sh = getSimpleHandlePosition(sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, sourcePosition, sourceShift);
  const th = getSimpleHandlePosition(targetRect.x, targetRect.y, targetRect.width, targetRect.height, targetPosition, targetShift);

  let startX = sh.x;
  let startY = sh.y;
  let endX = th.x;
  let endY = th.y;

  // Align axes for straight orthog segments if they are close
  const pairIsVertical = (sourcePosition === Position.Top || sourcePosition === Position.Bottom) &&
                         (targetPosition === Position.Top || targetPosition === Position.Bottom);
  const pairIsHorizontal = (sourcePosition === Position.Left || sourcePosition === Position.Right) &&
                           (targetPosition === Position.Left || targetPosition === Position.Right);

  if (pairIsVertical && Math.abs(startX - endX) < 16) {
    endX = startX;
  } else if (pairIsHorizontal && Math.abs(startY - endY) < 16) {
    endY = startY;
  }

  // 6. Find parallel sibling group index for edgeOffset spacing
  const parallelEdges = edges.filter(
    (e) =>
      (e.source === edge.source && e.target === edge.target) ||
      (e.source === edge.target && e.target === edge.source)
  );

  let edgeOffset = 0;
  if (edge.source !== edge.target && parallelEdges.length > 1) {
    const index = parallelEdges.findIndex((e) => e.id === edge.id);
    if (index !== -1) {
      edgeOffset = (index - (parallelEdges.length - 1) / 2) * 20;
    }
  }

  // 7. Calculate waypoints and svgPath
  const isStep = (edge.data as any)?.pathType === 'step';
  const borderRadius = isStep ? 0 : 40;

  let svgPath = '';
  let waypoints: Array<{ x: number; y: number }> = [];

  if (edge.source === edge.target) {
    const r = 40;
    svgPath = `M ${startX},${startY} C ${startX},${startY - r} ${endX + r},${endY} ${endX},${endY}`;
  } else {
    waypoints = getCollisionFreeWaypoints({
      sourceX: startX,
      sourceY: startY,
      targetX: endX,
      targetY: endY,
      sourcePosition,
      targetPosition,
      borderRadius,
      edgeOffset,
      nodeRects: nodeRectParam,
      excludedNodeIds: excludedIds,
    });

    let collides = false;
    for (let i = 0; i < waypoints.length - 1; i++) {
      for (const [, nr] of nodeRects) {
        if (segmentIntersectsRect(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y, nr.x, nr.y, nr.w, nr.h)) {
          collides = true;
          break;
        }
      }
      if (collides) break;
    }

    if (!collides) {
      svgPath = buildSmoothStepSvg(waypoints, borderRadius);
    } else {
      svgPath = getCollisionFreeSmoothStepPath({
        sourceX: startX,
        sourceY: startY,
        targetX: endX,
        targetY: endY,
        sourcePosition,
        targetPosition,
        borderRadius,
        edgeOffset,
        nodeRects: nodeRectParam,
        excludedNodeIds: excludedIds,
      });
      // Synchronize waypoints array for preview/export translation
      const fallbackWaypoints = getCollisionFreeWaypoints({
        sourceX: startX,
        sourceY: startY,
        targetX: endX,
        targetY: endY,
        sourcePosition,
        targetPosition,
        borderRadius,
        edgeOffset,
        nodeRects: nodeRectParam,
        excludedNodeIds: excludedIds,
      });
      if (fallbackWaypoints) {
        waypoints = fallbackWaypoints;
      }
    }
  }

  return {
    sourcePosition,
    targetPosition,
    sourcePoint: { x: startX, y: startY },
    targetPoint: { x: endX, y: endY },
    waypoints,
    svgPath,
  };
}
