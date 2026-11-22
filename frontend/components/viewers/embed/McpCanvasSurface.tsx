import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { ReactFlowProvider, useReactFlow, useNodesState, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import '@/components/canvas/nodes/nodeStyles.css';
import { CanvasGrid } from '@/components/canvas/CanvasGrid';
import { EDGE_TYPES, NODE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider } from '@/components/canvas/edges/DiagramGeometryProvider';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { useHoverFocus } from '@/lib/diagram/canvas/useHoverFocus';
import { SELECTION_FOCUS_CLASS } from '@/lib/diagram/canvas/selectionFocus';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { generatePureSVG } from '@/lib/diagram/export/svg';
import { previewCopyUrl } from '@/lib/diagram/canvas/previewCopy';
import { rasterizeExportSvg } from '@/lib/diagram/export/rasterizeSvg';
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
  nodes(): Node[];
}

const isDark = true;
type StudioPreviewStyle = 'studio-minimal' | 'studio-metallic';
const colorThemeId = 'studio-minimal';

function ViewportBridge({ controls, onReady, element }: {
  controls: ViewportControls;
  onReady(): void;
  element: HTMLElement;
}) {
  const { fitView, zoomIn, zoomOut, getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    controls.fit = () => { void fitView({ padding: 0.16 }); };
    controls.zoomIn = () => { void zoomIn({ duration: 100 }); };
    controls.zoomOut = () => { void zoomOut({ duration: 100 }); };
    onReady();
  }, [controls, fitView, zoomIn, zoomOut, onReady]);
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
  const { cssVars } = useMemo(() => resolveCanvasTokens({ renderStyleId, colorThemeId, isDark }), [renderStyleId]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const currentNodes = useRef(nodes);
  useEffect(() => {
    currentNodes.current = nodes;
    controls.nodes = () => currentNodes.current;
  }, [controls, nodes]);
  const host = useMemo<CanvasHost>(() => ({
    readOnly: true, nodes, edges, direction, isDark, renderStyleId, colorThemeId,
    iconMode: 'all', planKey: 'mcp-widget',
  }), [nodes, edges, direction, renderStyleId]);
  const focus = useHoverFocus(nodes, edges);
  return (
    <div
      className={focus.css ? `dark ${SELECTION_FOCUS_CLASS}` : 'dark'}
      data-render-style={renderStyleId}
      data-canvas-theme={colorThemeId}
      style={{ ...cssVars, height: '100%', width: '100%' } as CSSProperties}
    >
      {focus.css && <style>{focus.css}</style>}
      <CanvasHostProvider value={host}>
        <DiagramGeometryProvider nodes={nodes} edges={edges} isolated useWorker={false}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
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
            <ViewportBridge controls={controls} onReady={onReady} element={element} />
          </ReactFlow>
        </DiagramGeometryProvider>
      </CanvasHostProvider>
    </div>
  );
}

export function mount(
  element: HTMLElement,
  graph: Graph,
  onReady: () => void,
  onError: () => void,
  initialStyle: StudioPreviewStyle = 'studio-minimal',
) {
  const root = createRoot(element, { onUncaughtError: onError });
  const noop = () => {};
  const controls: ViewportControls = { fit: noop, zoomIn: noop, zoomOut: noop, nodes: () => graph.nodes };
  let renderStyleId = initialStyle;
  const render = () => root.render(
    <ReactFlowProvider>
      <Surface {...graph} renderStyleId={renderStyleId} controls={controls} onReady={onReady} element={element} />
    </ReactFlowProvider>,
  );
  render();
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
    async downloadPng(background: string) {
      const { cssVars } = resolveCanvasTokens({ renderStyleId, colorThemeId, isDark });
      const svg = generatePureSVG(controls.nodes(), graph.edges, isDark, background, graph.direction, renderStyleId, colorThemeId, 'all', {
        variant: 'lines', gap: DEFAULT_CANVAS_BACKGROUND.gap, size: DEFAULT_CANVAS_BACKGROUND.size,
        patternColor: cssVars['--arch-canvas-grid'] ?? null, showGrid: true,
      });
      return (await rasterizeExportSvg(svg, 2)).dataUrl;
    },
    dispose: () => root.unmount(),
  };
}
