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
import { resolveCanvasTokens, ensureSketchFontLoaded } from '@/lib/theme/renderStyles';
import { sketchHandwritingFont } from '@/lib/theme/renderStyles/sketchFont';
import '@/components/nodes/nodeStyles.css';
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
import { createNode, createEdge, createBlankShapeNode } from '@/lib/factory';
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
    setNodes, addNodeOnEdgeDrop, addNode,
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
    addNode: s.addNode,
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

  // Handle template from URL.
  // Run-once guard: without it, StrictMode double-invoke / re-renders with the
  // same searchParams create duplicate canvases and run the pipeline twice.
  const loadedTemplateRef = useRef<string | null>(null);
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) return;
    if (loadedTemplateRef.current === templateId) return;
    loadedTemplateRef.current = templateId;

    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      const newCanvasId = addCanvas(template.name);

      void (async () => {
        const layouted = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR', {
          title: template.name,
        });
        const nodes = layouted.success ? layouted.nodes : template.nodes;
        const edges = layouted.success ? layouted.edges : template.edges;
        if (!layouted.success && layouted.warnings.length > 0) {
          toast.warning('Template loaded without auto-layout', {
            description: layouted.warnings[0],
          });
        }
        importDiagram(nodes, edges);
        useDiagramStore.getState().setActiveLayoutPresetId('layered-lr');
        renameCanvas(newCanvasId, template.name);
        router.replace(`/editor?canvas=${newCanvasId}`);
        toast.success(`Loaded template: ${template.name}`);
        // No manual fitView here — importDiagram already animates one.
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
          // Shape-aware fallback — a blind fit gives cylinders/diamonds/etc.
          // rectangle proportions and the layout then under-reserves space.
          const dims = calculateNodeDimensions(n.data?.label || '', n.data?.subtitle || '', {
            shape: n.data?.shape as string | undefined,
            cylinderAxis: n.data?.cylinderAxis as 'vertical' | 'horizontal' | undefined,
          });
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

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current;
      connectStartRef.current = null;
      if (!start) return;

      const { clientX, clientY } = 'changedTouches' in event
        ? (event as TouchEvent).changedTouches[0]
        : (event as MouseEvent);

      // Minimum drag distance — ignore accidental clicks
      const dx = clientX - start.startX;
      const dy = clientY - start.startY;
      if (Math.sqrt(dx * dx + dy * dy) < 8) return;

      // React Flow already formed a handle-to-handle connection — do not spawn a node.
      if (connectSucceededRef.current) {
        connectSucceededRef.current = false;
        return;
      }

      // DOM fallback for older RF / empty-pane detection
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

      const rawFlowPos = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      // Center the new node under the cursor (addNodeOnEdgeDrop uses top-left).
      const flowPos = { x: rawFlowPos.x - 100, y: rawFlowPos.y - 44 };

      // Only spawn on empty canvas space — small guard to avoid stacking exactly on a node.
      const nearbyPadding = 20;
      const nearbyNodes = reactFlowInstance.getIntersectingNodes(
        {
          x: rawFlowPos.x - nearbyPadding,
          y: rawFlowPos.y - nearbyPadding,
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

  // Double-click empty canvas — drop a blank rounded draft under the cursor (inline rename starts).
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;
      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const node = createBlankShapeNode('rounded-rectangle', flowPos);
      node.position = {
        x: flowPos.x - (node.width ?? 160) / 2,
        y: flowPos.y - (node.height ?? 100) / 2,
      };
      addNode(node);
      setSelectedNodeId(node.id);
      setSelectedNodeIds([node.id]);
    },
    [reactFlowInstance, addNode, setSelectedNodeId, setSelectedNodeIds]
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

  // Shortcuts modal toggled by `?` key (Editor global shortcut handler).
  useEffect(() => {
    const handleToggleShortcuts = () => setShowShortcuts((open) => !open);
    document.addEventListener('toggle-shortcuts-modal', handleToggleShortcuts);
    return () => {
      document.removeEventListener('toggle-shortcuts-modal', handleToggleShortcuts);
    };
  }, []);

  const coloredEdges = useEdgeColors(edges);
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const canvasBackground = useDiagramStore((s) => s.canvasBackground);
  const themeVars = useMemo(
    () => resolveCanvasTokens({ renderStyleId: diagramRenderStyle, colorThemeId: diagramStyleTheme, isDark }).cssVars,
    [diagramStyleTheme, diagramRenderStyle, isDark],
  );

  // Self-host Nanum Pen Script when sketch is active (next/font + CDN fallback).
  useEffect(() => {
    if (diagramRenderStyle !== 'sketch') return;
    ensureSketchFontLoaded();
  }, [diagramRenderStyle]);

  const isSketch = diagramRenderStyle === 'sketch';

  return (
    <div 
      className={cn(
        'w-full h-full relative transition-colors duration-200 overscroll-contain',
        !canvasBackground.bgColor && 'bg-[hsl(var(--canvas-bg))]',
        diagramChromeMode === 'present' ? 'diagram-chrome-present' : 'diagram-chrome-edit',
        isSketch && sketchHandwritingFont.className,
      )}
      data-render-style={diagramRenderStyle}
      data-color-theme={diagramStyleTheme}
      data-pipeline={pipelineStatus}
        onDragOver={(e) => e.preventDefault()}
        onDoubleClick={onPaneDoubleClick}
      style={{ 
        overscrollBehavior: 'contain', 
        ...(canvasBackground.bgColor ? { backgroundColor: canvasBackground.bgColor } : {}),
        ...themeVars 
      }}
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
        zoomOnDoubleClick={false}
        connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
        connectionRadius={CANVAS_CONFIG.connectionRadius}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: isDark ? '#475569' : '#94a3b8', strokeWidth: 1.5, strokeDasharray: '6 4' }}
        snapToGrid={CANVAS_CONFIG.snapToGrid}
        snapGrid={CANVAS_CONFIG.snapGrid}
        defaultMarkerColor={isDark ? '#1E2130' : EDGE_CONFIG.strokeColor}
        minZoom={CANVAS_CONFIG.minZoom}
        maxZoom={CANVAS_CONFIG.maxZoom}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        proOptions={{ hideAttribution: true }}
      >
        {canvasBackground.variant !== 'plain' && showGrid && (
          <Background 
            variant={canvasBackground.variant as BackgroundVariant} 
            gap={canvasBackground.gap} 
            size={canvasBackground.size}
            color={canvasBackground.patternColor ?? (isDark ? '#475569' : CANVAS_CONFIG.background.color)}
            style={{ opacity: isDark ? 0.6 : 0.4 }}
          />
        )}
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
