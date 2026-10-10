'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useViewport,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { isStudioRenderStyle, resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { useEdgeColors } from '@/lib/edgeColors';
import { resolveNodeIconVisibility, type NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { studioContentNodeSize, studioCompactNodeSize } from '@/lib/utils/shapeNodeDimensions';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { SIZE_M } from '@/lib/theme/stylingConstants';
import '@/components/nodes/nodeStyles.css';
import styles from './LandingCanvasPreview.module.css';

function makeNode(
  id: string,
  label: string,
  subtitle: string,
  serviceType: string,
  category: string,
  layer: string,
  renderStyleId: string,
  iconMode: NodeIconMode,
): Node {
  const studio = isStudioRenderStyle(renderStyleId);
  const showIcon = resolveNodeIconVisibility(iconMode);
  const compact = studioCompactNodeSize(showIcon);
  const fitted = calculateNodeDimensions(label, subtitle, {
    shape: 'rounded-rectangle',
    minWidth: studio ? compact.width : SIZE_M,
    showIcon,
  });
  const cardWidth = studio
    ? Math.max(compact.width, fitted.width)
    : Math.max(SIZE_M, fitted.width);
  const dims = studio
    ? studioContentNodeSize(label, subtitle, showIcon, cardWidth)
    : { width: cardWidth, height: 100 };
  return {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    width: dims.width,
    height: dims.height,
    draggable: true,
    selectable: true,
    data: {
      typeId: serviceType === 'database' ? 'database' : serviceType === 'service' ? 'service' : serviceType,
      label,
      subtitle,
      serviceType,
      category,
      layer,
      nodeWidth: dims.width,
      nodeHeight: dims.height,
    },
  };
}

function makeNodes(renderStyleId: string, iconMode: NodeIconMode): Node[] {
  return [
    makeNode('browser', 'Web Browser', 'Web client', 'client', 'Client', 'client', renderStyleId, iconMode),
    makeNode('mobile', 'Mobile App', 'iOS / Android', 'client', 'Client', 'client', renderStyleId, iconMode),
    makeNode('load-balancer', 'Load Balancer', 'Traffic routing', 'api', 'Compute', 'compute', renderStyleId, iconMode),
    makeNode('api-gateway', 'API Gateway', 'Auth + routes', 'api', 'Compute', 'compute', renderStyleId, iconMode),
    makeNode('auth', 'Auth Service', 'Token validation', 'service', 'Compute', 'compute', renderStyleId, iconMode),
    makeNode('notification', 'Notification Service', 'Push delivery', 'service', 'Compute', 'compute', renderStyleId, iconMode),
    makeNode('chat', 'Chat Service', 'Messages + presence', 'service', 'Compute', 'compute', renderStyleId, iconMode),
    makeNode('postgres', 'PostgreSQL', 'Primary store', 'database', 'Data', 'data', renderStyleId, iconMode),
    makeNode('redis', 'Redis Cache', 'Sessions + cache', 'cache', 'Data', 'data', renderStyleId, iconMode),
    makeNode('broker', 'Message Broker', 'Event stream', 'queue', 'Async', 'async', renderStyleId, iconMode),
    makeNode('presence', 'Presence Service', 'Online state', 'service', 'Compute', 'compute', renderStyleId, iconMode),
  ];
}

// Curated desktop positions preserve the left-to-right flow and separated
// service lanes of the canvas users see in the editor.
export const LANDING_DESKTOP_POSITIONS: Record<string, { x: number; y: number }> = {
  browser: { x: 0, y: 0 },
  mobile: { x: 0, y: 270 },
  'load-balancer': { x: 460, y: 120 },
  'api-gateway': { x: 800, y: -10 },
  auth: { x: 1340, y: -10 },
  notification: { x: 460, y: 520 },
  chat: { x: 1080, y: 270 },
  postgres: { x: 1080, y: 520 },
  redis: { x: 1760, y: 120 },
  broker: { x: 1780, y: 415 },
  presence: { x: 2070, y: 260 },
};
const MOBILE_POSITIONS: Record<string, { x: number; y: number }> = {
  browser: { x: 0, y: 0 },
  mobile: { x: 186, y: 0 },
  'load-balancer': { x: 0, y: 104 },
  'api-gateway': { x: 186, y: 104 },
  auth: { x: 0, y: 208 },
  chat: { x: 186, y: 208 },
  notification: { x: 0, y: 312 },
  postgres: { x: 186, y: 312 },
  redis: { x: 0, y: 416 },
  broker: { x: 186, y: 416 },
  presence: { x: 93, y: 520 },
};

const edge = (
  id: string,
  source: string,
  target: string,
  label: string,
  sourceSide = 'right',
  targetSide = 'left',
  async = false,
  importance: 'primary' | 'secondary' = 'primary',
  labelT?: number,
): Edge => ({
  id,
  source,
  target,
  type: 'simpleFloating',
  sourceHandle: `source-${sourceSide}`,
  targetHandle: `target-${targetSide}`,
  label,
  animated: async,
  data: {
    label,
    connectionType: async ? 'async' : 'sync',
    pathType: 'Smoothstep',
    sourceSide,
    targetSide,
    importance: async ? 'secondary' : importance,
    isSpine: importance === 'primary' && !async,
    ...(labelT === undefined ? {} : { labelT }),
    ...(async ? { isAsync: true } : {}),
  },
});

export const LANDING_PREVIEW_EDGES: Edge[] = [
  edge('browser-http', 'browser', 'load-balancer', 'HTTP/REST', 'right', 'left'),
  edge('mobile-http', 'mobile', 'load-balancer', 'HTTP/REST', 'right', 'left'),
  edge('routes', 'load-balancer', 'api-gateway', 'routes'),
  edge('auth-request', 'api-gateway', 'auth', 'authenticates'),
  edge('auth-response', 'auth', 'api-gateway', 'validates token', 'left', 'right', false, 'secondary'),
  edge('gateway-chat', 'api-gateway', 'chat', 'request', 'bottom', 'top'),
  edge('notification-chat', 'notification', 'chat', 'pushes alert', 'right', 'left', false, 'secondary'),
  edge('chat-postgres', 'chat', 'postgres', 'read / write', 'bottom', 'top'),
  edge('chat-redis-write', 'chat', 'redis', 'caches message', 'right', 'left', true),
  edge('redis-chat-read', 'redis', 'chat', 'cache hit', 'left', 'right', false, 'secondary'),
  edge('chat-broker', 'chat', 'broker', 'publishes event', 'right', 'left', true),
  edge('redis-presence', 'redis', 'presence', 'updates presence', 'right', 'top'),
  edge('broker-presence', 'broker', 'presence', 'presence event', 'right', 'bottom', true),
];

function useNarrowCanvas() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 620px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isNarrow;
}

function useLayoutedGraph(isNarrow: boolean, renderStyleId: string, iconMode: NodeIconMode) {
  return useMemo(() => {
    const nodes = makeNodes(renderStyleId, iconMode);
    if (!isNarrow) {
      return {
        nodes: nodes.map((node) => ({ ...node, position: LANDING_DESKTOP_POSITIONS[node.id] })),
        edges: LANDING_PREVIEW_EDGES,
      };
    }

    const positionedNodes = nodes.map((node) => ({ ...node, position: MOBILE_POSITIONS[node.id] }));
    const positionById = new Map(positionedNodes.map((node) => [node.id, node.position]));
    const edges = LANDING_PREVIEW_EDGES.filter((connection) => !['auth-response', 'redis-chat-read'].includes(connection.id)).map((connection) => {
      const source = positionById.get(connection.source)!;
      const target = positionById.get(connection.target)!;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const sourceSide = horizontal ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
      const targetSide = horizontal ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
      return {
        ...connection,
        sourceHandle: `source-${sourceSide}`,
        targetHandle: `target-${targetSide}`,
        data: { ...connection.data, sourceSide, targetSide },
      };
    });

    return { nodes: positionedNodes, edges };
  }, [isNarrow, renderStyleId, iconMode]);
}

function Canvas() {
  const isNarrow = useNarrowCanvas();
  const renderStyleId = useDiagramStore((state) => state.diagramRenderStyle);
  const colorThemeId = useDiagramStore((state) => state.diagramStyleTheme);
  const iconMode = useDiagramStore((state) => state.iconMode);
  const showGrid = useDiagramStore((state) => state.showGrid);
  const canvasBackground = useDiagramStore((state) => state.canvasBackground);
  const { isDark } = useCanvasTheme();
  const appearance = useMemo(
    () => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }),
    [renderStyleId, colorThemeId, isDark],
  );
  const canvasGridColor = isDark
    ? appearance.cssVars['--arch-canvas-grid']
    : canvasBackground.patternColor ?? appearance.cssVars['--arch-canvas-grid'];
  const { nodes: layoutNodes, edges: layoutEdges } = useLayoutedGraph(isNarrow, renderStyleId, iconMode);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const coloredEdges = useEdgeColors(edges);
  const viewport = useViewport();
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);

  const onInit = useCallback((flow: ReactFlowInstance) => setInstance(flow), []);

  useEffect(() => {
    if (!instance) return;
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    const frame = requestAnimationFrame(() => {
      instance.fitView({ padding: isNarrow ? 0.1 : 0.12, minZoom: 0.25, maxZoom: isNarrow ? 0.72 : 2, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [instance, isNarrow, layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      className={styles.flow}
      nodes={nodes}
      edges={coloredEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onInit={onInit}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch
      zoomOnDoubleClick={false}
      preventScrolling={false}
      selectNodesOnDrag
      proOptions={{ hideAttribution: true }}
      fitView
      minZoom={0.25}
      maxZoom={isNarrow ? 0.72 : 2}
      fitViewOptions={{ padding: isNarrow ? 0.1 : 0.12, minZoom: 0.25, maxZoom: isNarrow ? 0.72 : 2, duration: 0 }}
    >
      {canvasBackground.variant === 'dots' && showGrid && (
        <Background
          variant={BackgroundVariant.Dots}
          gap={canvasBackground.gap}
          size={canvasBackground.size}
          color={canvasGridColor}
          style={{ opacity: isDark ? 0.35 : 0.5 }}
        />
      )}
      {canvasBackground.variant === 'lines' && showGrid && (
        <div
          className="archdraw-lines-background"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundColor: 'transparent',
            backgroundImage: `linear-gradient(to right, ${canvasGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${canvasGridColor} 1px, transparent 1px)`,
            backgroundSize: `${canvasBackground.gap * viewport.zoom}px ${canvasBackground.gap * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            opacity: isDark ? 0.25 : 1,
            pointerEvents: 'none',
          }}
        />
      )}
    </ReactFlow>
  );
}

function CanvasPreviewContent() {
  const renderStyleId = useDiagramStore((state) => state.diagramRenderStyle);
  const colorThemeId = useDiagramStore((state) => state.diagramStyleTheme);
  const canvasBackground = useDiagramStore((state) => state.canvasBackground);
  const { isDark } = useCanvasTheme();
  const appearance = useMemo(
    () => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }),
    [renderStyleId, colorThemeId, isDark],
  );

  return (
    <div
      className={`${styles.preview}${isDark ? ' dark' : ''}`}
      aria-label="An ArchDraw canvas preview showing a chat architecture with browser and mobile clients, gateway, authentication, messaging, cache, database, and presence services."
      data-render-style={renderStyleId}
      data-color-theme={colorThemeId}
      data-cursor-shine-exclude
      style={{
        ...appearance.cssVars,
        backgroundColor: isDark
          ? appearance.cssVars['--arch-canvas-bg']
          : canvasBackground.bgColor ?? appearance.cssVars['--arch-canvas-bg'],
        ['--arch-canvas-bg' as string]: isDark
          ? appearance.cssVars['--arch-canvas-bg']
          : canvasBackground.bgColor ?? appearance.cssVars['--arch-canvas-bg'],
      } as CSSProperties}
    >
      <div className={styles.chrome}>
        <span className={styles.canvasName}>Real-time chat architecture</span>
        <span className={styles.canvasStatus}>11 components <i /> 13 relationships</span>
      </div>
      <div className={styles.canvas}>
        <ReactFlowProvider><Canvas /></ReactFlowProvider>
      </div>
    </div>
  );
}

/**
 * The diagram store is persisted in localStorage. Its server snapshot uses the
 * defaults, while the browser snapshot may already contain a different theme
 * and canvas background. Render a stable shell for SSR and the first client
 * render, then mount the interactive canvas after hydration.
 */
export function LandingCanvasPreview() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (hydrated) return <CanvasPreviewContent />;

  return (
    <div
      className={`${styles.preview} dark`}
      aria-label="Loading the interactive chat architecture canvas preview"
      data-cursor-shine-exclude
    >
      <div className={styles.chrome}>
        <span className={styles.canvasName}>Real-time chat architecture</span>
        <span className={styles.canvasStatus}>11 components <i /> 13 relationships</span>
      </div>
      <div className={`${styles.canvas} ${styles.canvasPlaceholder}`} aria-hidden="true" />
    </div>
  );
}
