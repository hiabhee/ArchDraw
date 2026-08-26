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
import {
  getPointOnPath,
  findClosestT,
  shortenSvgPathEnd,
  SKETCH_ARROWHEAD_TRIM_PX,
} from '@/lib/utils/edgeLabelDrag';
import { buildSmoothStepSvg, trimWaypointsEnd } from '@/lib/utils/collisionFreeEdgePath';
import { computeEdgeLabelLayout } from '@/lib/utils/edgeLabelLayout';
import { sideFromDataString, getSharedTerminalEdges } from '@/lib/utils/simpleFloatingEdge';
import { useDiagramStore } from '@/store/diagramStore';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { useCanvasTheme } from '@/lib/theme';
import { EdgeLabel } from './EdgeLabel';
import { EdgeToolbar } from './EdgeToolbar';
import { EdgeContextMenu } from './EdgeContextMenu';
import { resolveEdgeStrokeDasharray } from '@/lib/utils/edgeStroke';
import type { EdgeData } from '@/data/edgeTypes';
import { resolveEdgePalette } from '@/lib/edgeColors';
import { isPrimaryEdge } from '@/lib/utils/edgeHierarchy';
import { getStrokeRenderer } from '@/lib/theme/renderStyles';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';

/** Darken a hex color by a fixed amount; leaves non-hex colors untouched. */
function darkenColor(color: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildSolidArrowheadPath(
  tip: { x: number; y: number },
  angle: number,
  length = 14,
  width = 12,
): string {
  const backX = tip.x - Math.cos(angle) * length;
  const backY = tip.y - Math.sin(angle) * length;
  const normalX = Math.cos(angle + Math.PI / 2);
  const normalY = Math.sin(angle + Math.PI / 2);
  const halfWidth = width / 2;
  const left = {
    x: backX + normalX * halfWidth,
    y: backY + normalY * halfWidth,
  };
  const right = {
    x: backX - normalX * halfWidth,
    y: backY - normalY * halfWidth,
  };
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

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
}: EdgeProps<EdgeData>) {
  const nodeInternals = useStore((s: ReactFlowState) => s.nodeInternals);
  const edges = useStore((s: ReactFlowState) => s.edges);
  const zoom = useStore((s: ReactFlowState) => s.transform[2]);
  const { getViewport } = useReactFlow();
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const activeLayoutPresetId = useDiagramStore((s) => s.activeLayoutPresetId);
  const [labelEditing, setLabelEditing] = useState(false);

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

  // Global label placement: positions for every labeled edge are resolved
  // together (per diagram state) so labels never overlap. The shared engine is
  // memoized on the store references, so this is cheap after the first edge.
  const labelLayouts = useMemo(
    () => computeEdgeLabelLayout(edges, nodeInternals, activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR'),
    [edges, nodeInternals, activeLayoutPresetId],
  );

  const {
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
    svgPath: edgePath,
    waypoints: routeWaypoints,
  } = route;

  // React Flow can briefly render an edge before both terminals are in
  // nodeInternals; keep the last good path so sketch overlays don't blink out.
  // Storing prior-render info via a conditional setState during render is the
  // React-sanctioned pattern (docs: "storing information from previous renders").
  const [lastGoodEdgePath, setLastGoodEdgePath] = useState('');
  if (edgePath && edgePath !== lastGoodEdgePath) {
    setLastGoodEdgePath(edgePath);
  }
  const stableEdgePath = edgePath || lastGoodEdgePath;

  const [isHovered, setIsHovered] = useState(false);

  const intermediateWaypoints = useMemo(() => {
    const stored = data?.customWaypoints as Array<{ x: number; y: number }> | undefined;
    if (!stored || stored.length === 0) return [];
    return stored;
  }, [data?.customWaypoints]);

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
    setLabelEditing(true);
  }, []);

  // React to the store "edit label" command (raised by EdgeContextMenu /
  // Canvas). This is an external-store event, so subscribe to the store rather
  // than setting state synchronously inside an effect.
  useEffect(() => {
    return useDiagramStore.subscribe((state, prevState) => {
      if (state.pendingLabelEdgeId === id && prevState.pendingLabelEdgeId !== id) {
        setLabelEditing(true);
        useDiagramStore.getState().setPendingLabelEdgeId(null);
      }
    });
  }, [id]);

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
  const { renderStyleId, colors } = useDiagramAesthetics();
  const sketch = renderStyleId === 'sketch';
  const sketchInk = useMemo(
    () => sketch
      ? { primary: colors.edgePrimary, default: colors.edgeDefault, async: colors.edgeAsync }
      : undefined,
    [sketch, colors.edgePrimary, colors.edgeDefault, colors.edgeAsync],
  );

  const strokeStyle: React.CSSProperties = useMemo(() => {
    const palette = resolveEdgePalette(data as Record<string, unknown> | undefined, isDark, sketch, sketchInk);
    let stroke = edgeStyle?.stroke || palette.stroke;
    const baseWidth = palette.strokeWidth ?? DIAGRAM_CONSTANTS.edge.strokeWidth;

    if (isBundle) {
      stroke = isDenseBundle ? '#475569' : '#94a3b8';
    }

    const isPrimary =
      palette.isPrimary === true ||
      isPrimaryEdge(data as Record<string, unknown> | undefined) ||
      edgeVariant === 'thick';
    const isHoverState = selected || isHovered;
    const strokeWidth =
      isHoverState
        ? baseWidth + 0.75
        : baseWidth;

    // Color bump on hover/focus: darken non-accent connectors so they read
    // more strongly when the user is inspecting them.
    if (isHoverState && !isPrimary && !isBundle) {
      stroke = darkenColor(stroke, isDark ? 10 : 20);
    }

    const strokeDasharray = resolveEdgeStrokeDasharray(
      data as Record<string, unknown> | undefined,
      edgeStyle,
    );

    const opacity = isHoverState
      ? 1
      : isBundle
        ? 0.85
        : (palette.opacity ?? (isAsync ? 0.92 : 0.9));

    return {
      stroke,
      strokeWidth,
      strokeDasharray,
      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
      opacity,
    };
  }, [edgeStyle, isAsync, selected, isHovered, isDark, isBundle, edgeVariant, edgeType, isDenseBundle, data, sketch, sketchInk]);

  const resolvedStroke = typeof strokeStyle.stroke === 'string' ? strokeStyle.stroke : undefined;
  const arrowheadColor = resolvedStroke ?? '#94a3b8';

  // Always show arrowhead — every edge keeps its marker even when
  // multiple edges share a terminal side. Previously only the first
  // edge in a merged group drew the tip, which looked like markers
  // disappearing during rearrange.
  const showMergedTargetMarker = true;

  const sketchDrawPath = useMemo(() => {
    if (!stableEdgePath) return '';
    if (routeWaypoints.length >= 2) {
      return buildSmoothStepSvg(
        trimWaypointsEnd(routeWaypoints, SKETCH_ARROWHEAD_TRIM_PX),
        24,
      );
    }
    return shortenSvgPathEnd(stableEdgePath, SKETCH_ARROWHEAD_TRIM_PX);
  }, [stableEdgePath, routeWaypoints]);

  const precisionArrowheadPath = useMemo(() => {
    if (sketch || !showMergedTargetMarker || !markerEnd || !stableEdgePath) return '';
    try {
      const pathEnd =
        routeWaypoints.length >= 2
          ? routeWaypoints[routeWaypoints.length - 2]
          : getPointOnPath(stableEdgePath, 0.98);
      const endAngle = Math.atan2(ty - pathEnd.y, tx - pathEnd.x);
      return buildSolidArrowheadPath({ x: tx, y: ty }, endAngle);
    } catch {
      return '';
    }
  }, [sketch, showMergedTargetMarker, markerEnd, stableEdgePath, routeWaypoints, tx, ty]);

  const sketchMarkup = useMemo(() => {
    if (!sketch || !sketchDrawPath) return '';
    const rough = getStrokeRenderer('rough');
    const seed = rough.seedFor(id);
    // Sketch palette: warm hand-ink spine + thinned strokes (from resolved tokens).
    const palette = resolveEdgePalette(data as Record<string, unknown> | undefined, isDark, true, sketchInk);
    // In sketch mode, always use the palette stroke (not data.color) to ensure consistent hand-drawn ink
    const strokeColor = palette.stroke;
    const width = palette.strokeWidth ?? DIAGRAM_CONSTANTS.edge.strokeWidth;
    const dasharray = strokeStyle.strokeDasharray ? String(strokeStyle.strokeDasharray) : undefined;
    const pathSVG = rough.renderEdgePath(
      sketchDrawPath,
      { d: sketchDrawPath, stroke: strokeColor, strokeWidth: width, dasharray, opacity: 1 },
      seed,
    );
    const parts = [pathSVG];
    if (showMergedTargetMarker) {
      try {
        const pathEnd =
          routeWaypoints.length >= 2
            ? trimWaypointsEnd(routeWaypoints, SKETCH_ARROWHEAD_TRIM_PX).at(-1)!
            : getPointOnPath(sketchDrawPath, 1);
        const endAngle = Math.atan2(ty - pathEnd.y, tx - pathEnd.x);
        parts.push(rough.renderArrowhead({ x: tx, y: ty }, endAngle, strokeColor, seed));
      } catch {
        // ignore — fall back to no arrowhead
      }
    }
    return parts.join('\n');
  }, [
    sketch, sketchDrawPath, strokeStyle.strokeDasharray, showMergedTargetMarker,
    routeWaypoints, tx, ty, id, data, isDark, sketchInk,
  ]);

  const rawLabel = responseLabel && typeof responseLabel === 'string' && responseLabel.trim()
    ? `${label || data?.label || ''} / ${responseLabel.trim()}`
    : (typeof data?.label === 'string' ? data.label.trim() : (typeof label === 'string' ? label.trim() : ''));

  const words = rawLabel ? rawLabel.split(/\s+/).filter(Boolean) : [];
  const truncated = words.length === 0 ? '' : words.length <= 3 ? rawLabel.trim() : words.slice(0, 3).join(' ');
  // Remove trailing slash (handles both "A/" and "A / " cases)
  const displayLabel = truncated.replace(/\s*\/\s*$/, '').trim();

  const parallelEdges = useMemo(
    () => edges.filter((edge) =>
      (edge.source === source && edge.target === target) ||
      (edge.source === target && edge.target === source)
    ).sort((a, b) => a.id.localeCompare(b.id)),
    [edges, source, target]
  );
  const labelOrder = Math.max(0, parallelEdges.findIndex((edge) => edge.id === id));
  const labelT = data?.labelT ?? (parallelEdges.length > 1 ? Math.max(0.2, Math.min(0.8, 0.5 + ((labelOrder - (parallelEdges.length - 1) / 2) * 0.15))) : 0.5);

  const labelPos = useMemo(() => {
    if (!displayLabel) return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    const resolved = labelLayouts.get(id);
    if (resolved) return { x: resolved.x, y: resolved.y, angle: 0 };
    try {
      return getPointOnPath(stableEdgePath, labelT);
    } catch {
      return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    }
  }, [labelLayouts, id, displayLabel, stableEdgePath, labelT, sx, sy, tx, ty]);

  // The edge-label layer lives inside the zoomed viewport, so labels are
  // positioned in world coordinates; counter-scale them so they stay legible
  // when zoomed out (never smaller than base size, capped so they don't
  // balloon and cover the diagram).
  const labelScale = Math.min(Math.max(1 / zoom, 1), 2);
  const labelTransform = (x: number, y: number, centering: string) =>
    `translate(${x}px, ${y}px) scale(${labelScale}) ${centering}`;

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
      if (labelEditing) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const { x: vpX, y: vpY, zoom } = getViewport();
        const flowX = (ev.clientX - vpX) / zoom;
        const flowY = (ev.clientY - vpY) / zoom;
        const newT = findClosestT(stableEdgePath, flowX, flowY);
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
    [stableEdgePath, getViewport, id, labelEditing, updateEdgeData]
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
        d={stableEdgePath}
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
        d={stableEdgePath}
        fill="none"
        strokeDasharray={sketch ? undefined : strokeStyle.strokeDasharray}
        className="react-flow__edge-path"
        style={sketch ? { stroke: 'transparent', strokeWidth: 0, opacity: 0, pointerEvents: 'none' } : strokeStyle}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleEdgeDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {precisionArrowheadPath ? (
        <path
          d={precisionArrowheadPath}
          fill={arrowheadColor}
          stroke={arrowheadColor}
          strokeWidth={0}
          style={{
            opacity: strokeStyle.opacity,
            pointerEvents: 'none',
            transition: 'fill 0.2s, stroke 0.2s, opacity 0.2s',
          }}
        />
      ) : null}

      {sketch && sketchMarkup ? (
        <g className="arch-sketch-edge" dangerouslySetInnerHTML={{ __html: sketchMarkup }} />
      ) : null}

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
      {(displayLabel || labelEditing) && (
        <EdgeLabelRenderer>
          <div
            onMouseDown={handleLabelMouseDown}
            onDoubleClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: 'absolute',
              transform: labelTransform(labelPos.x, labelPos.y, 'translate(-50%, -50%)'),
              transformOrigin: '0 0',
              pointerEvents: 'all',
              cursor: labelEditing ? 'text' : dragging ? 'grabbing' : 'grab',
              zIndex: 1000,
              userSelect: 'none',
              marginTop: '0px',
            }}
            title={labelEditing ? undefined : 'Double-click to edit'}
          >
            <EdgeLabel
              edgeId={id}
              label={displayLabel || rawLabel}
              labelX={labelPos.x}
              labelY={labelPos.y}
              color={resolvedStroke}
              editing={labelEditing}
              onEditingChange={setLabelEditing}
            />
          </div>
        </EdgeLabelRenderer>
      )}

      {isBundle && isHovered && bundledEdges && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: labelTransform(labelPos.x, labelPos.y - 16, 'translate(-50%, -100%)'),
              transformOrigin: '0 0',
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
          labelX={labelPos.x}
          labelY={labelPos.y}
        />
      )}

      {!isReturn && contextMenu && ReactDOM.createPortal(
        <EdgeContextMenu
          edgeId={id}
          position={contextMenu}
          onClose={closeMenu}
        />,
        document.body
      )}
    </>
  );
}
