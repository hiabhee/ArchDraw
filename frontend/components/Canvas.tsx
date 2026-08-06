'use client';

import ReactFlow, {
  Background, BackgroundVariant, MiniMap,
  useReactFlow, ReactFlowProvider,
  NodeMouseHandler,   EdgeMouseHandler, NodeDragHandler,
  SelectionMode, ConnectionLineType,
  ConnectionMode, MarkerType,
  type OnSelectionChangeParams,
  type Connection,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
  type OnConnectStart,
  type OnConnectEnd,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore, registerFitViewCallback } from '@/store/diagramStore';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';
import { TEMPLATES } from '@/data/templates/index';
import { GuideLines } from '@/components/GuideLines';
import { ContextMenu, type ContextMenuState } from '@/components/ContextMenu';
import { useSnapping } from '@/hooks/useSnapping';
import { CometTrailCanvas } from '@/components/CometTrailCanvas';
import { useMiddleMousePan } from '@/hooks/useCanvasInteractions';
import { useCallback, useEffect, useRef, DragEvent, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasTheme } from '@/lib/theme';
import { diagramThemeCssVars } from '@/lib/theme/stylingConstants';
import { cn } from '@/lib/utils';
import { SVGEdgeMarkerDefs } from '@/lib/utils/edgeColorUtils';

import { TemplateModal } from '@/components/TemplateModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasSkeleton } from '@/components/CanvasSkeleton';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { isValidConnection, wouldCreateCycle } from '@/lib/config/edgeConfig';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { CANVAS_CONFIG, DEFAULT_EDGE_OPTIONS, EDGE_CONFIG } from '@/lib/config';

import { useGrouping } from '@/hooks/useGrouping';
import { toast } from 'sonner';
import type { Node } from 'reactflow';
import { resolveNodeCollisions } from '@/src/utils/resolveNodeCollisions';
import { useEdgeColors } from '@/lib/edgeColors';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { createNode, createEdge } from '@/lib/factory';
import { reactFlowRef } from '@/lib/reactFlowRef';
import { resolveNodeDropConnection } from '@/lib/canvas/resolveNodeDropConnection';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
function CanvasInner() {

  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const pipelineStatus = useDiagramStore((s) => s.pipelineStatus);
  const isPenModeActive = useDiagramStore((s) => s.isPenModeActive);
  const showGrid = useDiagramStore((s) => s.showGrid);
  const diagramChromeMode = useDiagramStore((s) => s.diagramChromeMode);
  const diagramStyleTheme = useDiagramStore((s) => s.diagramStyleTheme);
  const selectedNodeIds = useDiagramStore((s) => s.selectedNodeIds);
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId);

  const {
    onNodesChange, onEdgesChange, onConnect, onReconnect,
    setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId,
    setPendingLabelEdgeId, setCanvasMode,
    setNodes, addNodeOnEdgeDrop,
  } = useDiagramStore(useShallow((s) => ({
    onNodesChange: s.onNodesChange,
    onEdgesChange: s.onEdgesChange,
    onConnect: s.onConnect,
    onReconnect: s.onReconnect,
    setSelectedNodeId: s.setSelectedNodeId,
    setSelectedNodeIds: s.setSelectedNodeIds,
    setSelectedEdgeId: s.setSelectedEdgeId,
    setPendingLabelEdgeId: s.setPendingLabelEdgeId,
    setCanvasMode: s.setCanvasMode,
    setNodes: s.setNodes,
    addNodeOnEdgeDrop: s.addNodeOnEdgeDrop,
  })));
  const { isDark } = useCanvasTheme();

  const reactFlowInstance = useReactFlow();
  const { onNodeDrag, onNodeDragStop: onNodeDragStopSnap } = useSnapping();
  useMiddleMousePan();
  useGrouping();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Node-on-edge-drop state
  const connectStartRef = useRef<{
    nodeId: string;
    handleType: 'source' | 'target' | null;
    handleId: string | null;
    startX: number;
    startY: number;
  } | null>(null);
  const connectSucceededRef = useRef(false);
  // Suppress the pane click that follows the same mouseup as edge-drop create.
  const suppressPaneClickRef = useRef(false);
  
  // Onboarding state - only show when canvas is empty
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(nodes.length === 0);
  const [isOnboardingFading, setIsOnboardingFading] = useState(false);

  // Keep module ref in sync so store.fitView() can call it directly
  useEffect(() => {
    reactFlowRef.instance = reactFlowInstance;
    registerFitViewCallback((opts) => reactFlowInstance.fitView(opts ?? { padding: 0.0, duration: 400 }));
    return () => {
      reactFlowRef.instance = null;
    };
  }, [reactFlowInstance]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const importDiagram = useDiagramStore((s) => s.importDiagram);
  const addCanvas = useDiagramStore((s) => s.addCanvas);
  const switchCanvas = useDiagramStore((s) => s.switchCanvas);
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  const saveCanvasToDB = useDiagramStore((s) => s.saveCanvasToDB);

  const renameCanvas = useDiagramStore((s) => s.renameCanvas);

  // Handle template from URL
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) return;

    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      const newCanvasId = addCanvas(template.name);

      void (async () => {
        const layouted = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR');
        const nodes = layouted.success ? layouted.nodes : template.nodes;
        const edges = layouted.success ? layouted.edges : template.edges;
        importDiagram(nodes, edges);
        useDiagramStore.getState().setActiveLayoutPresetId('layered-lr');
        renameCanvas(newCanvasId, template.name);
        router.replace(`/editor?canvas=${newCanvasId}`);
        toast.success(`Loaded template: ${template.name}`);
        setTimeout(() => {
          if (reactFlowRef.instance) {
            reactFlowRef.instance.fitView({ padding: 0.1, duration: 400 });
          }
        }, 100);
      })();
    } else {
      toast.error('Template not found');
      router.replace('/editor');
    }
  }, [searchParams, addCanvas, importDiagram, renameCanvas, router]);
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/diagram/session/${sessionId}`);
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to load diagram');
        return;
      }

      const data = await response.json();
      const isMCP = data.source === 'mcp';
      const nodesWithType = (data.nodes as Node[]).map((n) => {
        let nodeWidth = n.data?.nodeWidth;
        let nodeHeight = n.data?.nodeHeight;
        
        if (!nodeWidth || !nodeHeight) {
          const dims = calculateNodeDimensions(n.data?.label || '', n.data?.subtitle || '');
          nodeWidth = nodeWidth || dims.width;
          nodeHeight = nodeHeight || dims.height;
        }

        const { id, type, position, data: extraData, ...rest } = n;
        const mappedType = type === 'architectureNode' ? 'systemNode' : (type || 'systemNode');

        return createNode(
          (extraData?.typeId as string) || mappedType,
          extraData?.label || '',
          position || { x: 0, y: 0 },
          {
            id,
            type: mappedType,
            data: {
              ...extraData,
              nodeWidth,
              nodeHeight,
            },
            ...rest
          }
        );
      });
      const edgesWithType = (data.edges as Edge[]).map((e) => {
        const { id, source, target, label, type, sourceHandle, targetHandle, data: extraData, ...rest } = e;
        return createEdge(
          source,
          target,
          String(extraData?.label || label || ''),
          {
            id,
            type: 'simpleFloating',
            sourceHandle: undefined,
            targetHandle: undefined,
            data: {
              ...extraData,
              pathType: 'Smoothstep',
            },
            ...rest
          }
        );
      });
      
      const canvasName = isMCP ? `MCP: ${data.label || 'Diagram'}` : (data.label || 'Session Diagram');
      const canvasId = addCanvas(canvasName, sessionId);
      importDiagram(nodesWithType, edgesWithType);
      router.replace(`/editor?canvas=${canvasId}`);
      toast.success(`Diagram loaded: ${data.label || 'Untitled'}`);
    } catch {
      toast.error('Failed to load diagram');
    }
  }, [importDiagram, addCanvas, router]);

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (!sessionId) return;
    loadSession(sessionId);
  }, [searchParams, loadSession]);

  // Handle canvas ID from URL - only on initial load or external navigation
  const urlCanvasHandledRef = useRef(false);
  useEffect(() => {
    if (urlCanvasHandledRef.current) return;
    
    const canvasId = searchParams.get('canvas');
    if (!canvasId) {
      urlCanvasHandledRef.current = true;
      return;
    }
    
    // Check if canvas exists in store
    const canvases = useDiagramStore.getState().canvases;
    const exists = canvases.find(c => c.id === canvasId);
    
    if (exists) {
      switchCanvas(canvasId);
      urlCanvasHandledRef.current = true;
    }
  }, [searchParams, switchCanvas]);

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      onNodeDragStopSnap(event, node, draggedNodes);

      // Collision resolution
      const currentNodes = useDiagramStore.getState().nodes;
      const resolvedNodes = resolveNodeCollisions(currentNodes);

      const hasChanges = currentNodes.some((n, i) =>
        n.position.x !== resolvedNodes[i]?.position.x ||
        n.position.y !== resolvedNodes[i]?.position.y
      );

      const latestNodes = hasChanges ? resolvedNodes : useDiagramStore.getState().nodes;

      if (hasChanges) {
        // setNodes already calls saveCanvasToDB
        setNodes(resolvedNodes);
      } else {
        // Drag finished with no collision fix — persist the final positions.
        // onNodesChange intentionally skips saveCanvasToDB on position changes
        // (to prevent 60fps infinite loops), so we do one save here instead.
        saveCanvasToDB(activeCanvasId);
      }

      // Recalculate connection handles from the post-drag node positions
      useDiagramStore.getState().recalculateHandles(latestNodes);
    },
    [onNodeDragStopSnap, setNodes, saveCanvasToDB, activeCanvasId]
  );

  const onConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      connectSucceededRef.current = false;
      if (!params.nodeId) return;
      const { clientX, clientY } = 'touches' in _event
        ? _event.touches[0]
        : _event;
      connectStartRef.current = {
        nodeId: params.nodeId,
        handleType: params.handleType,
        handleId: params.handleId ?? null,
        startX: clientX,
        startY: clientY,
      };
    },
    []
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connectSucceededRef.current = true;
      }
      onConnect(connection);
    },
    [onConnect]
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const start = connectStartRef.current;
      connectStartRef.current = null;
      if (!start) return;

      const { clientX, clientY } = 'changedTouches' in event
        ? event.changedTouches[0]
        : event;

      // Minimum drag distance of 5px to avoid accidental triggers from clicks
      const dx = clientX - start.startX;
      const dy = clientY - start.startY;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return;

      // React Flow already formed a handle-to-handle connection — do not spawn a node.
      if (connectSucceededRef.current) {
        connectSucceededRef.current = false;
        return;
      }

      // Use the pointer position — event.target is often the pane after a valid connect.
      const dropTarget = document.elementFromPoint(clientX, clientY);

      const dropNodeEl = dropTarget?.closest('.react-flow__node') as Element | null;
      if (dropNodeEl) {
        const targetNodeId = dropNodeEl.getAttribute('data-id');
        if (targetNodeId && targetNodeId !== start.nodeId) {
          const connection = resolveNodeDropConnection({
            nodes: reactFlowInstance.getNodes(),
            originNodeId: start.nodeId,
            originHandleType: start.handleType,
            originHandleId: start.handleId,
            targetNodeId,
          });
          if (connection) {
            handleConnect(connection);
            return;
          }
        }
        // Dropped on a node body — never spawn an empty node here.
        return;
      }

      if (
        dropTarget?.closest('.react-flow__handle') ||
        dropTarget?.closest('.react-flow__edge')
      ) {
        return;
      }

      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      // Only spawn on empty canvas space — skip if another node is near the drop point.
      const nearbyPadding = 48;
      const nearbyNodes = reactFlowInstance.getIntersectingNodes(
        {
          x: flowPos.x - nearbyPadding,
          y: flowPos.y - nearbyPadding,
          width: nearbyPadding * 2,
          height: nearbyPadding * 2,
        },
        true
      );
      if (nearbyNodes.some((node) => node.id !== start.nodeId)) {
        return;
      }

      const newNodeId = addNodeOnEdgeDrop({
        originNodeId: start.nodeId,
        originHandleType: start.handleType,
        position: flowPos,
      });

      if (newNodeId) {
        // Same gesture fires pane click after connect end — ignore it once so
        // selection/focus aren't cleared while the label input auto-focuses.
        suppressPaneClickRef.current = true;
      }
    },
    [reactFlowInstance, addNodeOnEdgeDrop, handleConnect]
  );

  const onPaneClick = useCallback(() => {
    if (suppressPaneClickRef.current) {
      suppressPaneClickRef.current = false;
      return;
    }
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [setSelectedNodeIds, setSelectedEdgeId]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      const nodeIds = (selectedNodes || []).map((n) => n.id);
      setSelectedNodeIds(nodeIds);
      setSelectedNodeId(nodeIds.length === 1 ? nodeIds[0] : null);
      setSelectedEdgeId(selectedEdges && selectedEdges.length === 1 ? selectedEdges[0].id : null);
    },
    [setSelectedNodeIds, setSelectedNodeId, setSelectedEdgeId]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  // Label editing via `edit-edge-label` custom event (inline on the edge).
  useEffect(() => {
    const handleEditEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setPendingLabelEdgeId(customEvent.detail);
    };
    document.addEventListener('edit-edge-label', handleEditEvent);
    return () => {
      document.removeEventListener('edit-edge-label', handleEditEvent);
    };
  }, [setPendingLabelEdgeId]);

  const coloredEdges = useEdgeColors(edges);
  const themeVars = useMemo(
    () => diagramThemeCssVars(diagramStyleTheme, isDark),
    [diagramStyleTheme, isDark],
  );

  return (
    <div 
      className={cn(
        'w-full h-full relative transition-colors duration-200 bg-[hsl(var(--canvas-bg))] overscroll-contain',
        diagramChromeMode === 'present' ? 'diagram-chrome-present' : 'diagram-chrome-edit',
      )}
      onDragOver={(e) => e.preventDefault()}
      style={{ overscrollBehavior: 'contain', ...themeVars }}
    >
      <ReactFlow
        nodes={nodes}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onReconnect={onReconnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.0 }}
        selectionMode={SelectionMode.Full}
        // Keep canvas panning on middle/right mouse so left-drag can draw selection box.
        panOnDrag={isPenModeActive ? false : [1, 2]}
        // Trackpad/touchpad two-finger gesture should move (pan) the canvas.
        panOnScroll={isPenModeActive ? false : true}
        selectionOnDrag={isPenModeActive ? false : true}
        // Avoid hijacking two-finger scroll for zoom; zoom still works via controls/pinch.
        zoomOnScroll={false}
        zoomOnPinch={true}
        connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
        connectionRadius={CANVAS_CONFIG.connectionRadius}
        connectionLineType={ConnectionLineType.SmoothStep}
        snapToGrid={CANVAS_CONFIG.snapToGrid}
        snapGrid={CANVAS_CONFIG.snapGrid}
        defaultMarkerColor={isDark ? '#1E2130' : EDGE_CONFIG.strokeColor}
        minZoom={CANVAS_CONFIG.minZoom}
        maxZoom={CANVAS_CONFIG.maxZoom}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={CANVAS_CONFIG.background.variant as BackgroundVariant} 
          gap={CANVAS_CONFIG.background.gap} 
          size={CANVAS_CONFIG.background.size}
          color={isDark ? '#475569' : CANVAS_CONFIG.background.color}
          style={{ opacity: isDark ? 0.6 : 0.4 }}
        />
        <SVGEdgeMarkerDefs />
        <GuideLines />
      </ReactFlow>

      {/* Comet Trail Pen Overlay */}
      <CometTrailCanvas />

      <AnimatePresence>
        {pipelineStatus === 'generating' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none z-10"
          >
            <CanvasSkeleton />
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {selectedNodeIds.length >= 1 && (
        <div className="absolute bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg border border-border/40 bg-card/90 backdrop-blur-sm text-xs text-muted-foreground shadow-sm">
            Drag to select • Cmd/Ctrl+G to group
          </div>
        </div>
      )}



      <KeyboardShortcutsModal open={showShortcuts} onOpenChange={(open) => setShowShortcuts(open)} />
      {templatesOpen && <TemplateModal onClose={() => setTemplatesOpen(false)} />}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
