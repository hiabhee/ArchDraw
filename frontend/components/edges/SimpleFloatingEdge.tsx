'use client';

import { useMemo, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { 
  EdgeLabelRenderer,
  EdgeProps, 
  useReactFlow,
  useStore,
  ReactFlowState,
  Position,
  Node,
  Edge,
} from 'reactflow';
import { computeEdgeRoute } from '@/lib/utils/edgeRouteBuilder';
import { getPointOnPath, findClosestT } from '@/lib/utils/edgeLabelDrag';
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
  const sourceNode = useStore((s: ReactFlowState) => s.nodeInternals.get(source));
  const targetNode = useStore((s: ReactFlowState) => s.nodeInternals.get(target));
  const nodeInternals = useStore((s: ReactFlowState) => s.nodeInternals);
  const edges = useStore((s: ReactFlowState) => s.edges);
  const { getViewport } = useReactFlow();
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);

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
    return computeEdgeRoute(edgeObj, nodes, edges);
  }, [id, source, target, sourceHandleId, targetHandleId, data, nodeInternals, edges]);

  const {
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    sourcePoint: { x: sx, y: sy },
    targetPoint: { x: tx, y: ty },
    svgPath: edgePath,
  } = route;

  const [isHovered, setIsHovered] = useState(false);

  const isAsync = data?.edgeVariant === 'dashed' || data?.async || data?.connectionType === 'async';
  const { isDark } = useCanvasTheme();

  const strokeStyle: React.CSSProperties = useMemo(() => {
    const darkDefault = '#cbd5e1';
    const lightDefault = DIAGRAM_CONSTANTS.edge.stroke;
    let stroke = edgeStyle?.stroke || (isDark ? darkDefault : lightDefault);
    const baseWidth: number = DIAGRAM_CONSTANTS.edge.strokeWidth;

    const isDenseBundle = (data as Record<string, unknown>)?.isDenseBundle === true;
    if (data?.isBundle) {
      stroke = isDenseBundle ? '#4f46e5' : '#818cf8';
    }

    const strokeWidth = selected || isHovered ? baseWidth + 1.0 : baseWidth;

    let strokeDasharray: string | undefined;
    const edgeVariant = data?.edgeVariant;
    if (edgeVariant === 'dashed' || isAsync) {
      strokeDasharray = DIAGRAM_CONSTANTS.edge.dashArray;
    } else if (edgeVariant === 'dotted') {
      strokeDasharray = '2,2';
    } else if (edgeVariant === 'feedback') {
      strokeDasharray = '12,4,4,4';
    } else {
      const edgeTypeConfig = getEdgeConfig(data?.edgeType);
      if (edgeTypeConfig.dash) {
        strokeDasharray = edgeTypeConfig.dash;
      }
    }

    const opacity = selected || isHovered ? 1 : 0.85;

    return {
      stroke,
      strokeWidth,
      strokeDasharray,
      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
      opacity,
    };
  }, [edgeStyle, isAsync, selected, isHovered, isDark, data?.isBundle, data?.edgeVariant, data?.edgeType, data]);

  const responseLabel = data?.responseLabel;
  const isReturn = data?.isReturn || false;

  const displayLabel = responseLabel
    ? `${label || data?.label || ''} / ${responseLabel}`
    : (typeof data?.label === 'string' ? data.label.trim() : (typeof label === 'string' ? label.trim() : ''));

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
    try {
      return getPointOnPath(edgePath, labelT);
    } catch {
      return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    }
  }, [edgePath, labelT, displayLabel, sx, sy, tx, ty]);

  const safeLabelPos = labelPos;

  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);

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
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <path
        id={id}
        d={edgePath}
        fill="none"
        markerStart={markerStart}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
        style={strokeStyle}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            onMouseDown={handleLabelMouseDown}
            onDoubleClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${safeLabelPos.x}px, ${safeLabelPos.y}px)`,
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
              labelX={safeLabelPos.x}
              labelY={safeLabelPos.y}
            />
          </div>
        </EdgeLabelRenderer>
      )}

      {data?.isBundle && isHovered && data.bundledEdges && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${safeLabelPos.x}px, ${safeLabelPos.y - 16}px)`,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl px-3 py-2 text-xs max-w-xs flex flex-col gap-1 backdrop-blur-md bg-opacity-95">
              <div className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-1">
                Bundled Flows ({data.bundledEdges.length})
              </div>
              {data.bundledEdges.map((e: Edge, idx: number) => (
                <div key={e.id || idx} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
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
          labelX={safeLabelPos.x}
          labelY={safeLabelPos.y}
        />
      )}

      {!isReturn && contextMenu && ReactDOM.createPortal(
        <EdgeContextMenu
          edgeId={id}
          position={contextMenu}
          onClose={closeMenu}
          currentEdgeType={data?.edgeType}
          currentPathType={data?.pathType}
        />,
        document.body
      )}
    </>
  );
}
