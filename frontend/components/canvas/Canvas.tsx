'use client';

import ReactFlow, {
  Background, BackgroundVariant,
  useReactFlow, ReactFlowProvider, useViewport, useStore, useStoreApi,
  SelectionMode, ConnectionLineType,
  ConnectionMode,
  type OnSelectionChangeParams,
  type NodeChange,
  applyNodeChanges,
  type Connection,
  type Edge,
  type OnConnectStart,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore, registerFitViewCallback } from '@/store/diagramStore';
import { parsePastedImage } from '@/lib/diagram/nodes/pastedImage';
import { prepareImage } from '@/lib/client/imageDownscale';
import type { ImageNodeData } from '@/components/canvas/nodes/ImageNode';
import type { NodeData } from '@/store/diagram/types';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { TEMPLATES } from '@/data/templates/index';
import { GuideLines } from '@/components/canvas/GuideLines';
import { GroupBackgroundLayer } from '@/components/canvas/GroupBackgroundLayer';
import { AgentAtlasLayer } from '@/components/canvas/AgentAtlasLayer';
import { NeedsYouQueue } from '@/components/canvas/NeedsYouQueue';
import { ComponentHistoryCard } from '@/components/canvas/ComponentHistoryCard';
import { DetailMapEmpty } from '@/components/canvas/MapLevelToggle';
import { useProjectLiveStore } from '@/store/projectLiveStore';
import { anyNodeInView } from '@/lib/diagram/canvas/nodesInView';
import { ContextMenu, type ContextMenuState } from '@/components/editor/ContextMenu';
import { useSnapping } from '@/hooks/useSnapping';
import { CometTrailCanvas } from '@/components/canvas/CometTrailCanvas';
import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { resolveCanvasTokens, ensureSketchFontLoaded, ensureRenderStyleFontLoaded } from '@/lib/theme/renderStyles';
import { sketchHandwritingFont, sketchPatrickHandFont, sketchCaveatFont } from '@/lib/theme/renderStyles/sketchFont';
import '@/components/canvas/nodes/nodeStyles.css';
import { cn } from '@/lib/utils';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { useIsMobile } from '@/hooks/use-mobile';

import { TemplateModal } from '@/components/editor/modals/TemplateModal';
import { KeyboardShortcutsModal } from '@/components/editor/modals/KeyboardShortcutsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasSkeleton } from '@/components/canvas/CanvasSkeleton';
import { useSearchParams, useRouter } from 'next/navigation';

import { CANVAS_CONFIG, DEFAULT_EDGE_OPTIONS } from '@/lib/config';

import { useGrouping } from '@/hooks/useGrouping';
import { toast } from 'sonner';
import type { Node } from 'reactflow';
import { useEdgeColors } from '@/lib/theme/edgeColors';
import { calculateNodeDimensions } from '@/lib/diagram/nodes/nodeSizing';
import { createNode, createEdge, createBlankShapeNode, createTextLabelNode } from '@/lib/component-library/factory';
import { levelNearAlignedNodes } from '@/lib/diagram/geometry/levelNearAligned';
import { reactFlowRef } from '@/lib/client/reactFlowRef';
import { resolveNodeDropConnection } from '@/lib/diagram/canvas/resolveNodeDropConnection';
import { NODE_TYPES, EDGE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider } from '@/components/canvas/edges/DiagramGeometryProvider';
import { buildHighLevelGraph } from '@/lib/diagram/geometry/highLevelView';
import { computeSelectionFocus, selectionFocusCss, SELECTION_FOCUS_CLASS } from '@/lib/diagram/canvas/selectionFocus';
import { useHoverFocus } from '@/lib/diagram/canvas/useHoverFocus';
import { CanvasHostProvider, EDITOR_HOST, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';

// Isolated Suspense boundary for useSearchParams — prevents entire canvas from de-opting to CSR
function CanvasUrlSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const importDiagram = useDiagramStore((s) => s.importDiagram);
  const addCanvas = useDiagramStore((s) => s.addCanvas);
  const switchCanvas = useDiagramStore((s) => s.switchCanvas);
  const renameCanvas = useDiagramStore((s) => s.renameCanvas);

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
        const layouted = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR', { title: template.name });
        const nodes = layouted.success ? layouted.nodes : template.nodes;
        const edges = layouted.success ? layouted.edges : template.edges;
        if (!layouted.success && layouted.warnings.length > 0) {
          toast.warning('Template loaded without auto-layout', { description: layouted.warnings[0] });
        }
        importDiagram(nodes, edges);
        useDiagramStore.getState().setActiveLayoutPresetId('layered-lr');
        renameCanvas(newCanvasId, template.name);
        router.replace(`/editor?canvas=${newCanvasId}`);
        toast.success(`Loaded template: ${template.name}`);
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
          const dims = calculateNodeDimensions(n.data?.label || '', n.data?.subtitle || '', {
            shape: n.data?.shape as string | undefined,
            cylinderAxis: n.data?.cylinderAxis as 'vertical' | 'horizontal' | undefined,
          });
          nodeWidth = nodeWidth || dims.width;
          nodeHeight = nodeHeight || dims.height;
        }
        const { id, type, position, data: extraData, ...rest } = n;
        const mappedType = type === 'architectureNode' ? 'systemNode' : (type || 'systemNode');
        return createNode((extraData?.typeId as string) || mappedType, extraData?.label || '', position || { x: 0, y: 0 }, {
          id, type: mappedType, data: { ...extraData, nodeWidth, nodeHeight }, ...rest
        });
      });
      const edgesWithType = (data.edges as Edge[]).map((e) => {
        const { id, source, target, label, data: extraData, ...rest } = e;
        return createEdge(source, target, String(extraData?.label || label || ''), {
          id, type: 'simpleFloating', sourceHandle: undefined, targetHandle: undefined,
          data: { ...extraData, pathType: 'Smoothstep' }, ...rest
        });
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

  const urlCanvasHandledRef = useRef(false);
  useEffect(() => {
    if (urlCanvasHandledRef.current) return;
    const canvasId = searchParams.get('canvas');
    if (!canvasId) { urlCanvasHandledRef.current = true; return; }
    const canvases = useDiagramStore.getState().canvases;
    const exists = canvases.find(c => c.id === canvasId);
    if (exists) { switchCanvas(canvasId); urlCanvasHandledRef.current = true; }
  }, [searchParams, switchCanvas]);

  return null;
}

/** Positions the user gave boxes in the high-level view, per canvas (this browser only). */
const NO_DETAIL_EDGES: Edge[] = [];

function highLevelKey(canvasId: string | null) {
  return `archdraw-high-level:${canvasId ?? 'none'}`;
}
function readHighLevelPositions(canvasId: string | null): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(highLevelKey(canvasId)) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
function writeHighLevelPositions(canvasId: string | null, positions: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(highLevelKey(canvasId), JSON.stringify(positions));
  } catch {
    // storage unavailable: the arrangement just isn't remembered
  }
}

/** Only very large diagrams are culled to the viewport (see `onlyRenderVisibleElements`). */
const CULL_NODES_ABOVE = 400;

/**
 * The "lines" grid, kept in its own component: it follows every pan/zoom
 * frame, which must not re-render the whole canvas.
 */
function LinesBackground({ gap, color, opacity }: { gap: number; color: string; opacity: number }) {
  const { x, y, zoom } = useViewport();
  return (
    <div
      className="archdraw-lines-background"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundColor: 'transparent',
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        backgroundSize: `${gap * zoom}px ${gap * zoom}px`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}

function CanvasInner() {

  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const pipelineStatus = useDiagramStore((s) => s.pipelineStatus);
  const isPenModeActive = useDiagramStore((s) => s.isPenModeActive);
  const activeTool = useDiagramStore((s) => s.activeTool);
  const showGrid = useDiagramStore((s) => s.showGrid);
  const diagramChromeMode = useDiagramStore((s) => s.diagramChromeMode);
  const diagramStyleTheme = useDiagramStore((s) => s.diagramStyleTheme);
  const selectedNodeIds = useDiagramStore((s) => s.selectedNodeIds);
  const _selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId);
  const isMobile = useIsMobile();

  const {
    onEdgesChange, onConnect, onReconnect,
    setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId,
    setPendingLabelEdgeId,
    setNodes, addNodeOnEdgeDrop, addNode,
  } = useDiagramStore(useShallow((s) => ({
    onEdgesChange: s.onEdgesChange,
    onConnect: s.onConnect,
    onReconnect: s.onReconnect,
    setSelectedNodeId: s.setSelectedNodeId,
    setSelectedNodeIds: s.setSelectedNodeIds,
    setSelectedEdgeId: s.setSelectedEdgeId,
    setPendingLabelEdgeId: s.setPendingLabelEdgeId,
    setNodes: s.setNodes,
    addNodeOnEdgeDrop: s.addNodeOnEdgeDrop,
    addNode: s.addNode,
  })));
  const { isDark } = useCanvasTheme();

  const reactFlowInstance = useReactFlow();
  const { onNodesChange, onNodeDragStop: onNodeDragStopSnap } = useSnapping();
  // While a node is lined up with another, alignment wins over the grid so edges can line up exactly.
  const alignmentActive = useDiagramStore((s) => s.guideLines.length > 0);
  useGrouping();

  // Live migration for persisted groups saved before the zIndex fix.
  // In neubrutalism the group fill is opaque (#dbeafe), so a group with
  // zIndex 0/undefined visibly covers edges. New groups via createGroup
  // already have -1, but old canvases in this session still have stale
  // values until rehydrate on reload. Fix in-place without waiting for
  // a page refresh so the bug is gone immediately after HMR / code update.
  useEffect(() => {
    const isGroup = (n: Node) =>
      n.type === 'groupNode' ||
      n.type === 'group' ||
      n.type === 'frameNode' ||
      (n.data as { isGroup?: boolean } | undefined)?.isGroup === true;
    if (!nodes.some((n) => isGroup(n) && n.zIndex !== -1)) return;
    const fixed = nodes.map((n) => (isGroup(n) ? { ...n, zIndex: -1 } : n));
    // setNodes normalizes again (keeps -1) and persists
    setNodes(fixed);
  }, [nodes, setNodes]);

  // Live migration: snap 1-12px near-horizontal edges to 0° so existing
  // persisted diagrams (IMG1) don't need a click to become straight (IMG2).
  // Dagre's float positions can be y=100 vs 102.3; the edge then renders as
  // a diagonal slit above the grid line. This one-time fix aligns centers.
  const straightFixRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;
    const canvasId = useDiagramStore.getState().activeCanvasId;
    if (!canvasId || straightFixRef.current.has(canvasId)) return;
    const STRAIGHT_THRESHOLD = 12;
    const isVerticalLayout = useDiagramStore.getState().activeLayoutPresetId === 'layered-tb';
    let needsFix = false;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const getWH = (n: Node) => {
      const w = (n.width as number | undefined) ?? (n.data as unknown as { nodeWidth?: number })?.nodeWidth ?? 200;
      const h = (n.height as number | undefined) ?? (n.data as unknown as { nodeHeight?: number })?.nodeHeight ?? 100;
      return { w, h };
    };
    // Find first edge that would benefit
    for (const e of edges) {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) continue;
      const srcParent = (src as unknown as { parentId?: string }).parentId ?? (src as unknown as { parentNode?: string }).parentNode;
      const tgtParent = (tgt as unknown as { parentId?: string }).parentId ?? (tgt as unknown as { parentNode?: string }).parentNode;
      if (srcParent !== tgtParent) continue;
      const { w: sw, h: sh } = getWH(src);
      const { w: tw, h: th } = getWH(tgt);
      const srcCX = src.position.x + sw / 2;
      const srcCY = src.position.y + sh / 2;
      const tgtCX = tgt.position.x + tw / 2;
      const tgtCY = tgt.position.y + th / 2;
      const dx = tgtCX - srcCX;
      const dy = tgtCY - srcCY;
      const isHorizontalEdge = Math.abs(dx) > Math.abs(dy);
      if (!isVerticalLayout && !isHorizontalEdge) continue;
      if (isVerticalLayout && isHorizontalEdge) continue;
      const d = isVerticalLayout ? Math.abs(dx) : Math.abs(dy);
      if (d > 0.01 && d < STRAIGHT_THRESHOLD) {
        needsFix = true;
        break;
      }
    }
    if (!needsFix) {
      straightFixRef.current.add(canvasId);
      return;
    }
    // Perform same alignment as Dagre/import
    const edgesByDelta = [...edges]
      .map((e) => {
        const src = nodeById.get(e.source);
        const tgt = nodeById.get(e.target);
        if (!src || !tgt) return null;
        const srcParent = (src as unknown as { parentId?: string }).parentId ?? (src as unknown as { parentNode?: string }).parentNode;
        const tgtParent = (tgt as unknown as { parentId?: string }).parentId ?? (tgt as unknown as { parentNode?: string }).parentNode;
        if (srcParent !== tgtParent) return null;
        const { w: sw, h: sh } = getWH(src);
        const { w: tw, h: th } = getWH(tgt);
        const srcCX = src.position.x + sw / 2;
        const srcCY = src.position.y + sh / 2;
        const tgtCX = tgt.position.x + tw / 2;
        const tgtCY = tgt.position.y + th / 2;
        const dx = tgtCX - srcCX;
        const dy = tgtCY - srcCY;
        const d = isVerticalLayout ? Math.abs(dx) : Math.abs(dy);
        return { e, d, dx, dy, src, tgt };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.d < STRAIGHT_THRESHOLD && x.d > 0.01)
      .sort((a, b) => a.d - b.d);
    const moved = new Set<string>();
    const aligned = nodes.map((n) => ({ ...n, position: { ...n.position } }));
    const alignedById = new Map(aligned.map((n) => [n.id, n]));
    for (const { dx, dy, src, tgt } of edgesByDelta) {
      const isHorizontalEdge = Math.abs(dx) > Math.abs(dy);
      if (!isVerticalLayout && !isHorizontalEdge) continue;
      if (isVerticalLayout && isHorizontalEdge) continue;
      if (moved.has(tgt.id)) continue;
      const alignedTgt = alignedById.get(tgt.id);
      const alignedSrc = alignedById.get(src.id);
      if (!alignedTgt || !alignedSrc) continue;
      const { w: sw, h: sh } = getWH(alignedSrc);
      const { w: tw, h: th } = getWH(alignedTgt);
      if (!isVerticalLayout) {
        const desiredTgtY = alignedSrc.position.y + sh / 2 - th / 2;
        if (Math.abs(desiredTgtY - alignedTgt.position.y) < STRAIGHT_THRESHOLD) {
          alignedTgt.position.y = desiredTgtY;
          moved.add(tgt.id);
        }
      } else {
        const desiredTgtX = alignedSrc.position.x + sw / 2 - tw / 2;
        if (Math.abs(desiredTgtX - alignedTgt.position.x) < STRAIGHT_THRESHOLD) {
          alignedTgt.position.x = desiredTgtX;
          moved.add(tgt.id);
        }
      }
    }
    if (moved.size > 0) {
      setNodes(aligned);
    }
    straightFixRef.current.add(canvasId);
  }, [nodes, edges, setNodes]);

  // Stacking is now handled via CSS isolation + store migration above.
  // Previously a MutationObserver forced group zIndex to -1 via direct DOM;
  // removed per frontend-design audit — use token layers and CSS instead.

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
  const [_isOnboardingVisible, _setIsOnboardingVisible] = useState(nodes.length === 0);
  const [_isOnboardingFading, _setIsOnboardingFading] = useState(false);

  // Keep module ref in sync so store.fitView() can call it directly
  useEffect(() => {
    reactFlowRef.instance = reactFlowInstance;
    registerFitViewCallback((opts) => reactFlowInstance.fitView(opts ?? { padding: 0.0, duration: 400 }));
    return () => {
      reactFlowRef.instance = null;
    };
  }, [reactFlowInstance]);

  const dragRevision = useRef(0);

  // One undo step per drag, recorded at drag start; the moves in between are not recorded.
  const onNodeDragStart = useCallback(() => {
    dragRevision.current++;
    useDiagramStore.getState().pushHistory();
  }, []);

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      dragRevision.current++;
      onNodeDragStopSnap(event, node, draggedNodes);

      // The drop keeps the last snapped position. Layout repair is explicit;
      // moving neighbours or straightening again here makes the release jump.
      const store = useDiagramStore.getState();
      store.recalculateHandles(store.nodes);
    },
    [onNodeDragStopSnap]
  );

  const onSelectionDragStop = useCallback((event: React.MouseEvent, dragged: Node[]) => {
    if (dragged[0]) onNodeDragStop(event, dragged[0], dragged);
  }, [onNodeDragStop]);

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
    useProjectLiveStore.getState().openHistory(null);
    if (isMobile) {
      window.dispatchEvent(new CustomEvent('pane-click-mobile-close'));
    }
  }, [setSelectedNodeIds, setSelectedEdgeId, isMobile]);

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

  // Pictures: paste or drop an ArchDraw preview/image link, an image URL or an image file. It lands
  // as a picture node (a preview link is drawn in the editor's look and keeps its link), at the
  // viewport centre for a paste and under the cursor for a drop.
  const placeImage = useCallback((data: ImageNodeData, width: number, height: number, at?: { x: number; y: number }) => {
    const bounds = document.querySelector('.react-flow')?.getBoundingClientRect();
    const centre = reactFlowInstance.screenToFlowPosition(at ?? {
      x: (bounds?.left ?? 0) + (bounds?.width ?? window.innerWidth) / 2,
      y: (bounds?.top ?? 0) + (bounds?.height ?? window.innerHeight) / 2,
    });
    const id = `image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    addNode({
      id, type: 'imageNode', position: { x: centre.x - width / 2, y: centre.y - height / 2 },
      width, height, data,
    } as unknown as Node<NodeData>);
    setSelectedNodeId(id);
    setSelectedNodeIds([id]);
  }, [reactFlowInstance, addNode, setSelectedNodeId, setSelectedNodeIds]);

  const placeLink = useCallback((text: string, at?: { x: number; y: number }): boolean => {
    const link = parsePastedImage(text, {
      renderStyle: useDiagramStore.getState().diagramRenderStyle,
      dark: document.documentElement.classList.contains('dark'),
    });
    if (!link) return false;
    placeImage(link, 480, link.href ? 300 : 280, at);
    return true;
  }, [placeImage]);

  const placeFile = useCallback((file: File, at?: { x: number; y: number }) => {
    // Any normal image works: it is scaled and re-encoded to fit inside the diagram.
    const pending = file.size > 1_000_000 ? toast.loading('Preparing image…') : undefined;
    prepareImage(file)
      .then(({ src, width, height }) => {
        const scale = Math.min(1, 480 / width);
        placeImage({ src }, Math.round(width * scale), Math.round(height * scale) + 8, at);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'That image could not be added.'))
      .finally(() => { if (pending !== undefined) toast.dismiss(pending); });
  }, [placeImage]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select') || target.isContentEditable)) return;
      if (placeLink(event.clipboardData?.getData('text/plain') ?? '')) {
        event.preventDefault();
        return;
      }
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      placeFile(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [placeLink, placeFile]);

  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer?.types.includes('Files')) event.dataTransfer.dropEffect = 'copy';
  }, []);

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
  const diagramViewMode = useDiagramStore((s) => s.diagramViewMode);
  // High-level view: groups collapsed into single components, laid out fresh.
  // A read-only projection; the stored diagram is untouched.
  // Rebuilt only when the summary's content changes (groups, members, links),
  // not on every new nodes array — a rebuild re-lays it out and would undo
  // the user's arrangement mid-drag.
  const highLevelSignature = useMemo(() => {
    if (diagramViewMode !== 'overview') return null;
    const graph = buildHighLevelGraph(nodes, coloredEdges);
    if (!graph) return null;
    return JSON.stringify([
      graph.nodes.map((n) => [n.id, n.data?.label, n.data?.subtitle]),
      graph.edges.map((e) => [e.source, e.target, e.data?.connectionCount]),
    ]);
  }, [diagramViewMode, nodes, coloredEdges]);
  const highLevelSource = useMemo(
    () => (highLevelSignature ? buildHighLevelGraph(nodes, coloredEdges) : null),
    // Keyed on the summary's content on purpose (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highLevelSignature],
  );
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  const [highLevelGraph, setHighLevelGraph] = useState<{ source: object; nodes: Node[]; edges: typeof coloredEdges } | null>(null);
  useEffect(() => {
    if (!highLevelSource) return;
    let cancelled = false;
    // Lay the summary out both ways and keep the one that fits the window
    // better (a long left-to-right chain wastes most of a wide screen's height).
    void Promise.all([
      layoutDiagramViaMermaid(highLevelSource.nodes, highLevelSource.edges, 'LR'),
      layoutDiagramViaMermaid(highLevelSource.nodes, highLevelSource.edges, 'TD'),
    ]).then((results) => {
      if (cancelled) return;
      const viewAspect = window.innerWidth / Math.max(window.innerHeight - 160, 200);
      const fit = (r: (typeof results)[number]) => {
        if (!r.success || r.nodes.length === 0) return Infinity;
        const xs = r.nodes.flatMap((n) => [n.position.x, n.position.x + (n.width ?? 200)]);
        const ys = r.nodes.flatMap((n) => [n.position.y, n.position.y + (n.height ?? 100)]);
        const aspect = (Math.max(...xs) - Math.min(...xs)) / Math.max(Math.max(...ys) - Math.min(...ys), 1);
        return Math.abs(Math.log(aspect / viewAspect));
      };
      const best = fit(results[0]) <= fit(results[1]) ? results[0] : results[1];
      // Boxes the user arranged keep their place (view state; the diagram is untouched).
      const saved = readHighLevelPositions(activeCanvasId);
      const laidOut = best.success ? best.nodes : highLevelSource.nodes;
      setHighLevelGraph({
        source: highLevelSource,
        // Summary boxes are always movable (the layout pipeline can mark nodes fixed).
        nodes: laidOut.map((n) => ({ ...n, draggable: true, ...(saved[n.id] ? { position: saved[n.id] } : {}) })),
        edges: best.success ? best.edges : highLevelSource.edges,
      });
      // Fit once React Flow has measured the new boxes (a fit on the first
      // frame still sees the full diagram's bounds and leaves the summary tiny).
      for (const delay of [60, 350]) setTimeout(() => { if (!cancelled) reactFlowInstance.fitView({ padding: 0.16, duration: 300 }); }, delay);
    });
    return () => { cancelled = true; };
  }, [highLevelSource, activeCanvasId, reactFlowInstance]);
  // The summary is movable: drags change only this view's positions.
  const onHighLevelNodesChange = useCallback((changes: NodeChange[]) => {
    setHighLevelGraph((graph) => (graph ? { ...graph, nodes: applyNodeChanges(changes, graph.nodes) } : graph));
  }, []);
  const onHighLevelDragStop = useCallback((_event: React.MouseEvent, _node: Node, dragged: Node[]) => {
    const saved = readHighLevelPositions(activeCanvasId);
    for (const n of dragged) saved[n.id] = { x: n.position.x, y: n.position.y };
    writeHighLevelPositions(activeCanvasId, saved);
  }, [activeCanvasId]);
  // Until the summary is laid out, keep showing the full diagram.
  const highLevel = highLevelSource !== null && highLevelGraph?.source === highLevelSource ? highLevelGraph : null;

  // Live project "Detailed" level: the detailed map replaces the overview
  // (this canvas) as a view-only projection with the agents still on it.
  const projectLevel = useProjectLiveStore((s) => (s.canvasId === activeCanvasId && s.snapshot?.isProject ? s.level : 'overview'));
  const detailMap = useProjectLiveStore((s) => (s.canvasId === activeCanvasId ? s.detail : null));
  const detailEdges = useEdgeColors(detailMap?.edges ?? NO_DETAIL_EDGES);
  const [detailNodes, setDetailNodes] = useState<{ source: object; nodes: Node[] } | null>(null);
  if (detailMap && detailNodes?.source !== detailMap) {
    setDetailNodes({
      source: detailMap,
      nodes: detailMap.nodes.map((n) => ({ ...n, selected: false, dragging: false, ...(n.type === 'groupNode' ? { zIndex: -1 } : {}) })),
    });
  }
  const detailView = useMemo(
    () => (projectLevel === 'detail' && detailMap && detailNodes?.source === detailMap ? { nodes: detailNodes.nodes, edges: detailEdges } : null),
    [projectLevel, detailMap, detailNodes, detailEdges],
  );
  // Until the map arrives, "missing" is only what the server says: it has no
  // detailed map. Otherwise the map is still loading.
  const detailUpdatedAt = useProjectLiveStore((s) => (s.canvasId === activeCanvasId ? s.snapshot?.detailUpdatedAt : undefined));
  const detailPending = projectLevel === 'detail' && !detailMap;
  // On a live project, clicking a component opens its history (who worked on it and why).
  const isLiveProject = useProjectLiveStore((s) => s.canvasId === activeCanvasId && Boolean(s.snapshot?.isProject));
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    useProjectLiveStore.getState().openHistory(node.id);
  }, []);
  const detailMissing = detailPending && detailUpdatedAt === null;
  // Boxes of the detailed map can be moved for a better look; nothing is saved.
  const onDetailNodesChange = useCallback((changes: NodeChange[]) => {
    setDetailNodes((current) => (current ? { ...current, nodes: applyNodeChanges(changes, current.nodes) } : current));
  }, []);
  useEffect(() => {
    if (!detailView) return;
    for (const delay of [60, 350]) setTimeout(() => reactFlowInstance.fitView({ padding: 0.16, duration: 300 }), delay);
    // Frame the map when it appears or is redrawn, not on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailMap, projectLevel, reactFlowInstance]);

  /** A view-only projection replaces the editable diagram (high-level summary or detailed map). */
  const projection = detailView ?? highLevel;

  const onCanvasDrop = useCallback((event: React.DragEvent) => {
    if (projection) return;
    const at = { x: event.clientX, y: event.clientY };
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      event.preventDefault();
      // Several images fan out a little so none hides another.
      files.slice(0, 8).forEach((file, i) => placeFile(file, { x: at.x + i * 24, y: at.y + i * 24 }));
      return;
    }
    const text = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain') || '';
    if (text && placeLink(text.split('\n')[0], at)) event.preventDefault();
  }, [projection, placeFile, placeLink]);


  // A card is drawn at its own size, which can differ from the size the layout
  // assumed (a subtitle that wraps makes it taller), so two nodes lined up by their
  // tops end up with centres a few px apart and the edge between them kinks. Once
  // sizes are measured and nothing is being dragged, nodes joined by a nearly level
  // edge are levelled (see levelNearAligned). It changes nothing when there is
  // nothing to fix, and a fix needs no further fix, so it settles after one pass.
  const levelKey = useMemo(
    () => (projection ? '' : nodes.map((n) => `${n.id}:${n.width ?? ''}:${n.height ?? ''}`).join('|')),
    [nodes, projection],
  );
  useEffect(() => {
    if (!levelKey) return;
    const revision = dragRevision.current;
    const timer = setTimeout(() => {
      const store = useDiagramStore.getState();
      const current = store.nodes;
      if (revision !== dragRevision.current) return;
      if (current.some((n) => (n as Node & { dragging?: boolean }).dragging)) return;
      const connected = new Set(store.edges.flatMap((e) => [e.source, e.target]));
      if (!current.every((n) => !connected.has(n.id) || (n.width && n.height))) return; // still measuring
      const moves = levelNearAlignedNodes(current, store.edges, store.activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR');
      if (moves.size === 0) return;
      const next = current.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n));
      store.setNodes(next);
      store.recalculateHandles(next);
    }, 200);
    return () => clearTimeout(timer);
  }, [levelKey]);

  /**
   * Pane click. With the text tool armed, a click places a label at the cursor
   * (top-left, editing at once) and the tool returns to select. Projections are
   * view-only, so they never place anything.
   */
  const onPaneClickOrPlace = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool === 'text' && !projection && !suppressPaneClickRef.current) {
        const pos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const node = createTextLabelNode(pos, { autoStartEdit: true });
        const store = useDiagramStore.getState();
        store.pushHistory();
        store.appendNode(node);
        store.setActiveTool('select');
        setSelectedNodeId(node.id);
        setSelectedNodeIds([node.id]);
        return;
      }
      onPaneClick();
    },
    [activeTool, projection, reactFlowInstance, onPaneClick, setSelectedNodeId, setSelectedNodeIds]
  );

  const visibleNodes = projection?.nodes ?? nodes;
  const visibleEdges = projection?.edges ?? coloredEdges;
  const canvasHost = useMemo<CanvasHost>(
    () => (detailView
      ? { readOnly: true, showLiveActivity: true, nodes: detailView.nodes, edges: detailView.edges, planKey: 'detail-map' }
      : highLevel ? { readOnly: true, nodes: highLevel.nodes, edges: highLevel.edges, planKey: 'high-level' } : EDITOR_HOST),
    [detailView, highLevel],
  );
  // Selected nodes + their first-degree neighbours stay visible; the rest dims.
  const selectionFocusStyle = useMemo(() => {
    if (projection) return null;
    const focus = computeSelectionFocus(selectedNodeIds, nodes, edges);
    return focus ? selectionFocusCss(focus) : null;
  }, [projection, selectedNodeIds, nodes, edges]);
  // With nothing selected, hovering a component focuses its connections the same way
  // (off while drawing a connection, so every target stays visible).
  const isConnecting = useStore((s) => s.connectionNodeId !== null);
  const hoverFocus = useHoverFocus(visibleNodes, visibleEdges, !selectionFocusStyle && !isConnecting);
  const focusStyle = selectionFocusStyle ?? hoverFocus.css;
  const wasHighLevel = useRef(false);
  useEffect(() => {
    // Leaving the summary: frame the full diagram again.
    if (wasHighLevel.current && !highLevel) requestAnimationFrame(() => reactFlowInstance.fitView({ padding: 0.16, duration: 300 }));
    wasHighLevel.current = Boolean(highLevel);
  }, [highLevel, reactFlowInstance]);
  // React Flow fits only on its first render, which shows the copy saved in
  // this browser. The server copy that replaces it (on open, or when an agent
  // re-lays out a live project) can sit entirely off screen: frame it then.
  // A view that shows any part of the diagram is never moved.
  const rfStore = useStoreApi();
  useEffect(() => {
    if (visibleNodes.length === 0) return;
    // After React Flow has measured the new boxes.
    const timer = setTimeout(() => {
      const { width, height, transform, nodeInternals } = rfStore.getState();
      if (!width || !height || nodeInternals.size === 0) return;
      if (!anyNodeInView(nodeInternals.values(), transform, { width, height })) reactFlowInstance.fitView({ padding: 0.16, duration: 300 });
    }, 150);
    return () => clearTimeout(timer);
  }, [visibleNodes, rfStore, reactFlowInstance]);
  const diagramRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const canvasBackground = useDiagramStore((s) => s.canvasBackground);
  const themeVars = useMemo(
    () => resolveCanvasTokens({ renderStyleId: diagramRenderStyle, colorThemeId: diagramStyleTheme, isDark }).cssVars,
    [diagramStyleTheme, diagramRenderStyle, isDark],
  );

  // Self-host Nanum Pen Script when sketch is active (next/font + CDN fallback).
  useEffect(() => {
    if (diagramRenderStyle === 'sketch') {
      ensureSketchFontLoaded();
    } else {
      ensureRenderStyleFontLoaded(diagramRenderStyle);
    }
  }, [diagramRenderStyle]);

  const isSketch = diagramRenderStyle === 'sketch';

  const sketchFontClass = isSketch
    ? `${sketchHandwritingFont.variable} ${sketchPatrickHandFont.variable} ${sketchCaveatFont.variable} ${sketchPatrickHandFont.className}`
    : '';

  // React Flow parent MUST have explicit width/height — #1 blank canvas cause (skill Rule 3).
  // Editor.tsx provides fixed inset-0 (100dvh); this div resolves h-full → explicit via style fallback.
  return (
    <div
      className={cn(
        'w-full h-full relative transition-colors duration-200 overscroll-contain',
        !canvasBackground.bgColor && 'bg-[var(--arch-canvas-bg)]',
        diagramChromeMode === 'present' ? 'diagram-chrome-present' : 'diagram-chrome-edit',
        isSketch && sketchFontClass,
        focusStyle && SELECTION_FOCUS_CLASS,
      )}
      data-render-style={diagramRenderStyle}
      data-color-theme={diagramStyleTheme}
      data-pipeline={pipelineStatus}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onDoubleClick={projection ? undefined : onPaneDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        overscrollBehavior: 'contain',
        ...themeVars,
        ...(canvasBackground.bgColor ? {
          backgroundColor: canvasBackground.bgColor,
          ['--arch-canvas-bg' as string]: canvasBackground.bgColor,
        } : {}),
      }}
    >
      {focusStyle && <style>{focusStyle}</style>}
      <CanvasHostProvider value={canvasHost}>
      <DiagramGeometryProvider nodes={visibleNodes} edges={visibleEdges}>
      <ReactFlow
        className={activeTool === 'text' ? 'arch-tool-text' : undefined}
        nodes={visibleNodes}
        edges={visibleEdges}
        // The high-level summary is view-only: its nodes are synthetic, so no
        // change may reach the store (or its auto-save).
        onNodesChange={detailView ? onDetailNodesChange : highLevel ? onHighLevelNodesChange : onNodesChange}
        onEdgesChange={projection ? undefined : onEdgesChange}
        onConnect={projection ? undefined : handleConnect}
        onReconnect={projection ? undefined : onReconnect}
        onConnectStart={projection ? undefined : onConnectStart}
        onConnectEnd={projection ? undefined : onConnectEnd}
        onNodeDragStart={projection ? undefined : onNodeDragStart}
        onSelectionDragStart={projection ? undefined : onNodeDragStart}
        onSelectionDragStop={projection ? undefined : onSelectionDragStop}
        onNodeDragStop={detailView ? undefined : highLevel ? onHighLevelDragStop : onNodeDragStop}
        onPaneClick={onPaneClickOrPlace}
        onNodeClick={isLiveProject && (!highLevel || detailView) ? onNodeClick : undefined}
        onNodeMouseEnter={hoverFocus.onNodeMouseEnter}
        onNodeMouseLeave={hoverFocus.onNodeMouseLeave}
        onSelectionChange={projection ? undefined : onSelectionChange}
        onNodeContextMenu={projection ? undefined : onNodeContextMenu}
        onPaneContextMenu={projection ? undefined : onPaneContextMenu}
        nodesDraggable
        nodesConnectable={!projection}
        elementsSelectable={!projection}
        deleteKeyCode={projection ? null : undefined}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        // Culling remounts nodes as they cross the screen edge (re-measuring
        // handles and sizes), which costs more than it saves below a few hundred.
        onlyRenderVisibleElements={visibleNodes.length > CULL_NODES_ABOVE}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        fitView
        // Reserve room for the floating toolbar and prompt bar so the first
        // fit never puts edge nodes underneath editor chrome.
        fitViewOptions={{ padding: isMobile ? 0.15 : 0.16 }}
        selectionMode={isMobile ? SelectionMode.Partial : SelectionMode.Full}
        // Keep canvas panning on middle/right mouse so left-drag can draw selection box.
        // On mobile, allow single-finger pan for better touch handling.
        panOnDrag={isPenModeActive ? false : isMobile ? [0, 1, 2] : [1, 2]}
        // Trackpad/touchpad two-finger gesture should move (pan) the canvas.
        panOnScroll={isPenModeActive ? false : true}
        selectionOnDrag={isPenModeActive ? false : !isMobile}
        // Avoid hijacking two-finger scroll for zoom; zoom still works via controls/pinch.
        // On mobile, allow pinch and double-tap zoom for better UX.
        zoomOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={isMobile ? true : false}
        connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
        connectionRadius={isMobile ? 28 : CANVAS_CONFIG.connectionRadius}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: themeVars['--arch-edge-primary'], strokeWidth: 1.5, strokeDasharray: '6 4' }}
        snapToGrid={CANVAS_CONFIG.snapToGrid && !alignmentActive}
        snapGrid={CANVAS_CONFIG.snapGrid}
        defaultMarkerColor={themeVars['--arch-edge-primary']}
        minZoom={CANVAS_CONFIG.minZoom}
        maxZoom={CANVAS_CONFIG.maxZoom}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        proOptions={{ hideAttribution: true }}
      >
        {!projection && <GroupBackgroundLayer />}
        {canvasBackground.variant === 'dots' && showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={canvasBackground.gap}
            size={canvasBackground.size}
            color={canvasBackground.patternColor ?? themeVars['--arch-canvas-grid'] ?? (isDark ? '#94a3b8' : '#e2e8f0')}
            style={{ opacity: isDark ? 0.35 : 0.5 }}
          />
        )}
        {canvasBackground.variant === 'lines' && showGrid && (
          <LinesBackground
            gap={canvasBackground.gap}
            color={canvasBackground.patternColor ?? themeVars['--arch-canvas-grid'] ?? (isDark ? 'hsl(var(--grid-color))' : '#e5e7eb')}
            opacity={isDark ? 0.25 : 1}
          />
        )}
        <SVGEdgeMarkerDefs />
        <GuideLines />
        {(!highLevel || detailView) && <AgentAtlasLayer />}
        {(!highLevel || detailView) && <NeedsYouQueue className="!top-20" />}
        {isLiveProject && activeCanvasId && (!highLevel || detailView) && (
          <ComponentHistoryCard historyUrl={`/api/projects/${encodeURIComponent(activeCanvasId)}/history`} className="!top-16" />
        )}
      </ReactFlow>
      {detailPending && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/40">
          {detailMissing ? <DetailMapEmpty /> : <span className="text-sm text-muted-foreground">Loading the detailed map…</span>}
        </div>
      )}
      </DiagramGeometryProvider>
      </CanvasHostProvider>

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
      <Suspense fallback={null}>
        <CanvasUrlSync />
      </Suspense>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
