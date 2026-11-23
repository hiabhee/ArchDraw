import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { ReactFlowProvider, useReactFlow, useNodesInitialized, useNodesState, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import '@/components/canvas/nodes/nodeStyles.css';
import { CanvasGrid } from '@/components/canvas/CanvasGrid';
import { EDGE_TYPES, NODE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider, useDiagramGeometryPlan } from '@/components/canvas/edges/DiagramGeometryProvider';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { useHoverFocus } from '@/lib/diagram/canvas/useHoverFocus';
import { SELECTION_FOCUS_CLASS } from '@/lib/diagram/canvas/selectionFocus';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { assignEdgeColors } from '@/lib/theme/edgeColors';
import { edgeThemeInk } from '@/lib/theme/edgeInk';
import { captureDiagram } from '@/lib/diagram/export/captureDiagram';
import { previewCopyUrl } from '@/lib/diagram/canvas/previewCopy';
import { recoverMcpLayout } from '@/lib/diagram/canvas/recoverMcpLayout';
import { levelNearAlignedNodes } from '@/lib/diagram/geometry/levelNearAligned';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { CANVAS_CONFIG, DEFAULT_CANVAS_BACKGROUND, DEFAULT_EDGE_OPTIONS } from '@/lib/config';

interface Graph {
  nodes: Node[];
  edges: Edge[];
  direction: 'LR' | 'TD';
}

interface ViewportControls {
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoom(): number;
  nodes(): Node[];
}

const isDark = true;
type StudioPreviewStyle = 'studio-minimal' | 'studio-metallic';
const colorThemeId = 'studio-minimal';

function ViewportBridge({ controls, onReady, element, layoutReady, needsRoutes }: {
  controls: ViewportControls;
  onReady(): void;
  element: HTMLElement;
  layoutReady: boolean;
  needsRoutes: boolean;
}) {
  const { fitView, zoomIn, zoomOut, getViewport, setViewport } = useReactFlow();
  const plan = useDiagramGeometryPlan();
  const shown = useRef(false);
  useEffect(() => {
    controls.fit = () => { void fitView({ padding: 0.16 }); };
    controls.zoomIn = () => { void zoomIn({ duration: 100 }); };
    controls.zoomOut = () => { void zoomOut({ duration: 100 }); };
    controls.zoom = () => getViewport().zoom;
  }, [controls, fitView, zoomIn, zoomOut, getViewport]);
  useEffect(() => {
    if (shown.current || !layoutReady || (needsRoutes && (!plan || plan.provisional))) return;
    shown.current = true;
    onReady();
  }, [layoutReady, needsRoutes, onReady, plan]);
  useEffect(() => {
    let width = element.clientWidth;
    let height = element.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth;
      const nextHeight = element.clientHeight;
      if (width && height && nextWidth && nextHeight && (width !== nextWidth || height !== nextHeight)) {
        const view = getViewport();
        // Keep the point at the center in view when the host expands or shrinks.
        void setViewport({ x: view.x + (nextWidth - width) / 2, y: view.y + (nextHeight - height) / 2, zoom: view.zoom });
      }
      width = nextWidth;
      height = nextHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, getViewport, setViewport]);
  return null;
}

function Surface({ nodes: initialNodes, edges, direction, renderStyleId, controls, onReady, element }: Graph & {
  element: HTMLElement;
  renderStyleId: StudioPreviewStyle;
  controls: ViewportControls;
  onReady(): void;
}) {
  const { cssVars, colors } = useMemo(() => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }), [renderStyleId]);
  const displayedEdges = useMemo(() => assignEdgeColors(edges, isDark, false, edgeThemeInk(colors)), [edges, colors]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [layoutReady, setLayoutReady] = useState(false);
  const nodesInitialized = useNodesInitialized();
  const { getNodes } = useReactFlow();
  useEffect(() => {
    if (layoutReady || !nodesInitialized) return;
    const moves = levelNearAlignedNodes(getNodes(), edges, direction);
    if (moves.size) {
      setNodes(current => current.map(node => {
        const position = moves.get(node.id);
        return position ? { ...node, position, positionAbsolute: undefined } : node;
      }));
    }
    setLayoutReady(true);
  }, [direction, edges, getNodes, layoutReady, nodesInitialized, setNodes]);

  const currentNodes = useRef(nodes);
  useLayoutEffect(() => {
    currentNodes.current = nodes;
    controls.nodes = () => currentNodes.current;
  }, [controls, nodes]);
  const host = useMemo<CanvasHost>(() => ({
    readOnly: true, nodes, edges: displayedEdges, direction, isDark, renderStyleId, colorThemeId,
    iconMode: 'all', planKey: 'mcp-widget',
  }), [nodes, displayedEdges, direction, renderStyleId]);
  const focus = useHoverFocus(nodes, displayedEdges);
  return (
    <div
      className={focus.css ? `dark diagram-chrome-present ${SELECTION_FOCUS_CLASS}` : 'dark diagram-chrome-present'}
      data-render-style={renderStyleId}
      data-color-theme={colorThemeId}
      style={{ ...cssVars, backgroundColor: cssVars['--arch-canvas-bg'], height: '100%', width: '100%' } as CSSProperties}
    >
      {focus.css && <style>{focus.css}</style>}
      <CanvasHostProvider value={host}>
        <DiagramGeometryProvider nodes={nodes} edges={displayedEdges} isolated useWorker={false} enabled={layoutReady}>
          <ReactFlow
            nodes={nodes}
            edges={displayedEdges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            defaultMarkerColor={cssVars['--arch-edge-primary']}
            onNodesChange={onNodesChange}
            nodesDraggable
            deleteKeyCode={null}
            nodesConnectable={false}
            elementsSelectable
            elevateNodesOnSelect={false}
            onNodeMouseEnter={focus.onNodeMouseEnter}
            onNodeMouseLeave={focus.onNodeMouseLeave}
            panOnDrag
            panOnScroll
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            zoomOnPinch
            minZoom={CANVAS_CONFIG.minZoom}
            maxZoom={CANVAS_CONFIG.maxZoom}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            proOptions={{ hideAttribution: true }}
          >
            <CanvasGrid background={DEFAULT_CANVAS_BACKGROUND} isDark gridColor={cssVars['--arch-canvas-grid']} />
            <SVGEdgeMarkerDefs />
            <ViewportBridge controls={controls} onReady={onReady} element={element} layoutReady={layoutReady} needsRoutes={edges.some(edge => !edge.hidden)} />
          </ReactFlow>
        </DiagramGeometryProvider>
      </CanvasHostProvider>
    </div>
  );
}

export function mount(
  element: HTMLElement,
  graph: Omit<Graph, 'direction'> & { direction?: Graph['direction'] },
  onReady: () => void,
  onError: () => void,
  initialStyle: StudioPreviewStyle = 'studio-minimal',
) {
  const root = createRoot(element, { onUncaughtError: onError });
  const noop = () => {};
  const controls: ViewportControls = { fit: noop, zoomIn: noop, zoomOut: noop, zoom: () => 1, nodes: () => graph.nodes };
  let renderStyleId = initialStyle;
  let disposed = false;
  let previewGraph: Graph | undefined;
  const render = () => {
    if (disposed || !previewGraph) return;
    root.render(
      <ReactFlowProvider>
        <Surface {...previewGraph} renderStyleId={renderStyleId} controls={controls} onReady={onReady} element={element} />
      </ReactFlowProvider>,
    );
  };
  void recoverMcpLayout(graph.nodes, graph.edges, graph.direction).then(recovered => {
    previewGraph = { ...graph, ...recovered };
    render();
  }).catch(() => { if (!disposed) onError(); });
  return {
    setStyle(style: StudioPreviewStyle) {
      if ((style === 'studio-minimal' || style === 'studio-metallic') && style !== renderStyleId) {
        renderStyleId = style;
        render();
      }
    },
    fit: () => controls.fit(),
    zoomIn: () => controls.zoomIn(),
    zoomOut: () => controls.zoomOut(),
    saveUrl: (shareUrl: string) => previewCopyUrl(shareUrl, crypto.randomUUID(), graph.nodes, controls.nodes()),
    async downloadPng() {
      if (!previewGraph) throw new Error('The preview is still drawing.');
      const { cssVars, colors } = resolveCanvasTokens({ renderStyleId, colorThemeId, isDark });
      const { dataUrl } = await captureDiagram({
        nodes: controls.nodes(),
        edges: assignEdgeColors(previewGraph.edges, isDark, false, edgeThemeInk(colors)),
        view: { readOnly: true, direction: previewGraph.direction, renderStyleId, colorThemeId, isDark, iconMode: 'all', labelZoom: controls.zoom() },
        background: { ...DEFAULT_CANVAS_BACKGROUND, patternColor: cssVars['--arch-canvas-grid'] },
        showGrid: true,
        useGeometryWorker: false,
      });
      return dataUrl;
    },
    dispose() {
      disposed = true;
      root.unmount();
    },
  };
}
