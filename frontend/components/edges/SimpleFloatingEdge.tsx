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
    // Prefer the color already set by useEdgeColors on the edge style prop.
    // Fall back to theme-aware defaults so dark mode always works even if the
    // prop chain hasn't propagated yet.
    const darkDefault = '#cbd5e1';
    const lightDefault = DIAGRAM_CONSTANTS.edge.stroke; // '#94a3b8'
    const stroke = edgeStyle?.stroke || (isDark ? darkDefault : lightDefault);
    const strokeWidth = selected || isHovered ? 2.5 : DIAGRAM_CONSTANTS.edge.strokeWidth;
    const strokeDasharray = isAsync ? DIAGRAM_CONSTANTS.edge.dashArray : undefined;

    return {
      stroke,
      strokeWidth,
      strokeDasharray,
      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
      opacity: selected || isHovered ? 1 : 0.85,
    };
  }, [edgeStyle, isAsync, selected, isHovered, isDark]);

  const edgeLabel = typeof data?.label === 'string' ? data.label.trim() : (typeof label === 'string' ? label.trim() : '');

  const parallelEdges = useMemo(
    () => edges.filter((edge) => 
      (edge.source === source && edge.target === target) ||
      (edge.source === target && edge.target === source)
    ).sort((a, b) => a.id.localeCompare(b.id)),
    [edges, source, target]
  );
  const labelOrder = Math.max(0, parallelEdges.findIndex((edge) => edge.id === id));
  const labelT = data?.labelT ?? (parallelEdges.length > 1 ? Math.max(0.2, Math.min(0.8, 0.5 + ((labelOrder - (parallelEdges.length - 1) / 2) * 0.15))) : 0.5);

  // Compute label position from labelT along the SVG path
  const labelPos = useMemo(() => {
    if (!edgeLabel) return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    try {
      return getPointOnPath(edgePath, labelT);
    } catch {
      return { x: (sx + tx) / 2 || 0, y: (sy + ty) / 2 || 0, angle: 0 };
    }
  }, [edgePath, labelT, edgeLabel, sx, sy, tx, ty]);

  // Labels always stay on the edge path — never jump to node edges
  const safeLabelPos = labelPos;

  // Drag state
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
      {/* Interaction layer */}
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
      {/* Visual layer */}
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
      {edgeLabel && (
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
              label={edgeLabel}
              labelX={safeLabelPos.x}
              labelY={safeLabelPos.y}
            />
          </div>
        </EdgeLabelRenderer>
      )}

      {selected && (
        <EdgeToolbar
          edgeId={id}
          currentLabel={data?.label}
          currentEdgeType={data?.edgeType}
          currentPathType={data?.pathType}
          labelX={safeLabelPos.x}
          labelY={safeLabelPos.y}
        />
      )}

      {contextMenu && ReactDOM.createPortal(
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
