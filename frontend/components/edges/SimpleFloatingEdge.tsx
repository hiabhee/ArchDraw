'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  EdgeLabelRenderer,
  EdgeProps,
  useReactFlow,
  useStore,
  ReactFlowState,
  Position,
  Edge,
} from 'reactflow';
import { computeEdgeRoute } from '@/lib/utils/edgeRouteBuilder';
import { getPointOnPath, findClosestT } from '@/lib/utils/edgeLabelDrag';
import { getNodeCenter, getSimpleEdgePositions } from '@/lib/utils/simpleFloatingEdge';
import { useDiagramStore } from '@/store/diagramStore';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { useCanvasTheme } from '@/lib/theme';
import { EdgeLabel } from './EdgeLabel';
import { EdgeToolbar } from './EdgeToolbar';
import { EdgeContextMenu } from './EdgeContextMenu';
import { getEdgeConfig } from '@/data/edgeTypes';
import type { EdgeData } from '@/data/edgeTypes';

export default function SimpleFloatingEdge({
  id,
  source,
  target,
  label,
  data,
  selected,
  style: edgeStyle,
  sourceX = 0,
  sourceY = 0,
  targetX = 0,
  targetY = 0,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  sourceHandleId,
  targetHandleId,
  markerEnd,
  markerStart,
}: EdgeProps<EdgeData>) {
  const nodeInternals = useStore((s: ReactFlowState) => s.nodeInternals);
  const edges = useStore((s: ReactFlowState) => s.edges);
  const { getViewport } = useReactFlow();
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);

  // Extract primitive data values for stable memoization
  const edgeVariant = data?.edgeVariant;
  const isBundle = data?.isBundle;
  const edgeType = data?.edgeType;
  const isAsync = edgeVariant === 'dashed' || data?.async || data?.connectionType === 'async';
  const customWaypoints = data?.customWaypoints as Array<{ x: number; y: number }> | undefined;
  const responseLabel = data?.responseLabel;
  const isReturn = data?.isReturn || false;
  const bundledEdges = data?.bundledEdges;
  const isDenseBundle = (data as Record<string, unknown>)?.isDenseBundle === true;

  const route = useMemo(() => {
    const nodes = Array.from(nodeInternals.values());
    const edgeObj: Edge = {
      id,
      source,
      target,
      sourceHandle: sourceHandleId,
      targetHandle: targetHandleId,
      data,
    } as Edge;
    return computeEdgeRoute(
      edgeObj,
      nodes,
      edges,
      activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR',
    );
  }, [id, source, target, sourceHandleId, targetHandleId, data, nodeInternals, edges, activeLayoutPresetId]);

  const {
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
    svgPath: edgePath,
  } = route;

  const [isHovered, setIsHovered] = useState(false);

  const intermediateWaypoints = useMemo(() => {
    if (route.waypoints.length <= 2) return [];
    return route.waypoints.slice(1, -1);
  }, [route.waypoints]);

  const ensureCustomWaypoints = useCallback(() => {
    const currentCustom = useDiagramStore.getState().edges.find(e => e.id === id)?.data?.customWaypoints;
    if (currentCustom && (currentCustom as Array<{ x: number; y: number }>).length > 0) {
      return currentCustom as Array<{ x: number; y: number }>;
    }
    const computed = route.waypoints.slice(1, -1);
    if (computed.length > 0) {
      updateEdgeData(id, { customWaypoints: computed });
      return computed;
    }
    return [];
  }, [id, route.waypoints, updateEdgeData]);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handleWaypointDrag = useCallback((waypointIndex: number) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startCustom = ensureCustomWaypoints() as Array<{ x: number; y: number }>;
      const startIndex = waypointIndex;

      const onMouseMove = (ev: MouseEvent) => {
        const { x: vpX, y: vpY, zoom } = getViewport();
        const flowX = (ev.clientX - vpX) / zoom;
        const flowY = (ev.clientY - vpY) / zoom;
        const snappedX = Math.round(flowX / 20) * 20;
        const snappedY = Math.round(flowY / 20) * 20;

        const updated = [...startCustom];
        updated[startIndex] = { x: snappedX, y: snappedY };
        updateEdgeData(id, { customWaypoints: updated });
      };

      const onMouseUp = () => {
        dragCleanupRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      dragCleanupRef.current = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    };
  }, [ensureCustomWaypoints, getViewport, id, updateEdgeData]);

  const handleEdgeDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { x: vpX, y: vpY, zoom } = getViewport();
    const flowX = (e.clientX - vpX) / zoom;
    const flowY = (e.clientY - vpY) / zoom;
    const snappedX = Math.round(flowX / 20) * 20;
    const snappedY = Math.round(flowY / 20) * 20;

    const currentCustom = (data?.customWaypoints as Array<{ x: number; y: number }> | undefined) || [];
    const points = currentCustom.length > 0
      ? [route.sourcePoint, ...currentCustom, route.targetPoint]
      : route.waypoints;

    let bestInsertIndex = points.length - 1;
    let bestDist = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((flowX - a.x) * dx + (flowY - a.y) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx, py = a.y + t * dy;
      const dist = (flowX - px) ** 2 + (flowY - py) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestInsertIndex = i + 1;
      }
    }

    const newCustom = [...currentCustom];
    newCustom.splice(bestInsertIndex - (currentCustom.length > 0 ? 0 : 1), 0, { x: snappedX, y: snappedY });
    updateEdgeData(id, { customWaypoints: newCustom });
  }, [data?.customWaypoints, getViewport, id, route.sourcePoint, route.targetPoint, route.waypoints, updateEdgeData]);

  const handleWaypointRemove = useCallback((waypointIndex: number) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentCustom = (data?.customWaypoints as Array<{ x: number; y: number }> | undefined) || route.waypoints.slice(1, -1);
      if (currentCustom.length <= 1) {
        updateEdgeData(id, { customWaypoints: undefined });
        return;
      }
      const newCustom = [...currentCustom];
      newCustom.splice(waypointIndex, 1);
      updateEdgeData(id, { customWaypoints: newCustom });
    };
  }, [data?.customWaypoints, id, route.waypoints, updateEdgeData]);

  const { isDark } = useCanvasTheme();

  const strokeStyle: React.CSSProperties = useMemo(() => {
    const darkDefault = '#cbd5e1';
    const lightDefault = DIAGRAM_CONSTANTS.edge.stroke;
    let stroke = edgeStyle?.stroke || (isDark ? darkDefault : lightDefault);
    const baseWidth: number = DIAGRAM_CONSTANTS.edge.strokeWidth;

    if (isBundle) {
      stroke = isDenseBundle ? '#4f46e5' : '#818cf8';
    }

    // Calculate edge length (no longer used for styling - spacing is handled in layout)
    const edgeLength = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
    
    // Use standard stroke width - let layout handle visibility through proper spacing
    let strokeWidth = selected || isHovered ? baseWidth + 1.0 : edgeVariant === 'thick' ? baseWidth + 1.5 : baseWidth;

    let strokeDasharray: string | undefined;
    if (edgeVariant === 'dashed' || isAsync) {
      strokeDasharray = DIAGRAM_CONSTANTS.edge.dashArray;
    } else if (edgeVariant === 'dotted') {
      strokeDasharray = '2,2';
    } else if (edgeVariant === 'feedback') {
      strokeDasharray = '12,4,4,4';
    } else {
      const edgeTypeConfig = getEdgeConfig(edgeType);
      if (edgeTypeConfig.dash) {
        strokeDasharray = edgeTypeConfig.dash;
      }
    }

    // Standard opacity - let layout handle visibility through proper spacing
    const opacity = selected || isHovered ? 1 : 0.85;

    return {
      stroke,
      strokeWidth,
      strokeDasharray,
      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
      opacity,
    };
  }, [edgeStyle, isAsync, selected, isHovered, isDark, isBundle, edgeVariant, edgeType, isDenseBundle]);

  const rawLabel = responseLabel
    ? `${label || data?.label || ''} / ${responseLabel}`
    : (typeof data?.label === 'string' ? data.label.trim() : (typeof label === 'string' ? label.trim() : ''));

  const displayLabel = useMemo(() => {
    if (!rawLabel) return '';
    const words = rawLabel.split(/\s+/).filter(Boolean);
    if (words.length <= 3) return rawLabel.trim();
    return words.slice(0, 3).join(' ');
  }, [rawLabel]);

  const parallelEdges = useMemo(
    () => edges.filter((edge) =>
      (edge.source === source && edge.target === target) ||
      (edge.source === target && edge.target === source)
    ).sort((a, b) => a.id.localeCompare(b.id)),
    [edges, source, target]
  );
  const labelOrder = Math.max(0, parallelEdges.findIndex((edge) => edge.id === id));
  const labelT = data?.labelT ?? (parallelEdges.length > 1 ? Math.max(0.2, Math.min(0.8, 0.5 + ((labelOrder - (parallelEdges.length - 1) / 2) * 0.15))) : 0.5);

  // Same-side terminal merge: edges that share this target side land on one
  // handler. Only the first edge by id draws the arrowhead so the join reads
  // as a single connection (multiple paths, one tip).
  const showMergedTargetMarker = useMemo(() => {
    const siblings = edges
      .filter((e) => e.target === target)
      .filter((e) => {
        if (e.id === id) return true;
        const srcNode = nodeInternals.get(e.source);
        const tgtNode = nodeInternals.get(e.target);
        if (!srcNode || !tgtNode) return false;
        const sc = getNodeCenter(srcNode);
        const tc = getNodeCenter(tgtNode);
        const { targetPos: side } = getSimpleEdgePositions(sc.cx, sc.cy, tc.cx, tc.cy);
        return side === targetPos;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    if (siblings.length <= 1) return true;
    return siblings[0]?.id === id;
  }, [edges, target, targetPos, nodeInternals, id]);

  const showMergedSourceMarker = useMemo(() => {
    if (!markerStart) return false;
    const siblings = edges
      .filter((e) => e.source === source)
      .filter((e) => {
        if (e.id === id) return true;
        const srcNode = nodeInternals.get(e.source);
        const tgtNode = nodeInternals.get(e.target);
        if (!srcNode || !tgtNode) return false;
        const sc = getNodeCenter(srcNode);
        const tc = getNodeCenter(tgtNode);
        const { sourcePos: side } = getSimpleEdgePositions(sc.cx, sc.cy, tc.cx, tc.cy);
        return side === sourcePos;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    if (siblings.length <= 1) return true;
    return siblings[0]?.id === id;
  }, [edges, source, sourcePos, nodeInternals, id, markerStart]);

  const labelPos = useMemo(() => {
    if (!displayLabel) return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    try {
      return getPointOnPath(edgePath, labelT);
    } catch {
      return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    }
  }, [edgePath, labelT, displayLabel, sx, sy, tx, ty]);

  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);

  const labelDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      labelDragCleanupRef.current?.();
    };
  }, []);

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const { x: vpX, y: vpY, zoom } = getViewport();
        const flowX = (ev.clientX - vpX) / zoom;
        const flowY = (ev.clientY - vpY) / zoom;
        const newT = findClosestT(edgePath, flowX, flowY);
        if (useDiagramStore.getState().activeCanvasId) {
          updateEdgeData(id, { labelT: newT });
        }
      };

      const onMouseUp = () => {
        isDragging.current = false;
        setDragging(false);
        labelDragCleanupRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      labelDragCleanupRef.current = () => {
        isDragging.current = false;
        setDragging(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    },
    [edgePath, getViewport, id, updateEdgeData]
  );

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    window.addEventListener('contextmenu', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleClick);
    };
  }, [contextMenu]);

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleEdgeDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <path
        id={id}
        d={edgePath}
        fill="none"
        markerStart={showMergedSourceMarker ? markerStart : undefined}
        markerEnd={showMergedTargetMarker ? markerEnd : undefined}
        className="react-flow__edge-path"
        style={strokeStyle}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleEdgeDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {selected && intermediateWaypoints.length > 0 && intermediateWaypoints.map((wp, idx) => (
        <g key={`wp-${idx}`} style={{ pointerEvents: 'all' }}>
          <circle
            cx={wp.x}
            cy={wp.y}
            r={16}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="none"
            style={{ cursor: 'grab' }}
            onMouseDown={handleWaypointDrag(idx)}
            onDoubleClick={handleWaypointRemove(idx)}
          />
          <circle
            cx={wp.x}
            cy={wp.y}
            r={5}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={2}
            style={{ cursor: 'grab', pointerEvents: 'none' }}
          />
        </g>
      ))}
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            onMouseDown={handleLabelMouseDown}
            onDoubleClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPos.x}px, ${labelPos.y}px)`,
              pointerEvents: 'all',
              cursor: dragging ? 'grabbing' : 'grab',
              zIndex: 1000,
              userSelect: 'none',
            }}
            title="Drag to reposition label"
          >
            <EdgeLabel
              edgeId={id}
              label={displayLabel}
              labelX={labelPos.x}
              labelY={labelPos.y}
            />
          </div>
        </EdgeLabelRenderer>
      )}

      {isBundle && isHovered && bundledEdges && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelPos.x}px, ${labelPos.y - 16}px)`,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl px-3 py-2 text-xs max-w-xs flex flex-col gap-1 backdrop-blur-md bg-opacity-95">
              <div className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-1">
                Bundled Flows ({bundledEdges.length})
              </div>
              {bundledEdges.map((e: Edge, idx: number) => (
                <div key={e.id || idx} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="font-semibold text-xs">{e.data?.label || e.label || 'request'}</span>
                  {e.data?.protocol && (
                    <span className="text-[9px] px-1 bg-muted text-muted-foreground rounded font-mono">
                      {e.data.protocol}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {!isReturn && selected && (
        <EdgeToolbar
          edgeId={id}
          currentLabel={data?.label}
          currentEdgeType={data?.edgeType}
          currentPathType={data?.pathType}
          currentSourceSide={data?.sourceSide}
          currentTargetSide={data?.targetSide}
          hasCustomWaypoints={!!customWaypoints && customWaypoints.length > 0}
          labelX={labelPos.x}
          labelY={labelPos.y}
        />
      )}

      {!isReturn && contextMenu && ReactDOM.createPortal(
        <EdgeContextMenu
          edgeId={id}
          position={contextMenu}
          onClose={closeMenu}
          currentEdgeType={data?.edgeType}
          currentPathType={data?.pathType}
          currentSourceSide={data?.sourceSide}
          currentTargetSide={data?.targetSide}
          hasCustomWaypoints={!!customWaypoints && customWaypoints.length > 0}
        />,
        document.body
      )}
    </>
  );
}
