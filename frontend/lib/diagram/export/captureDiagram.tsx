'use client';

import { useEffect, useId, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { ReactFlowProvider, useNodesInitialized, type Edge, type Node, type ReactFlowInstance } from 'reactflow';
import { CanvasGrid } from '@/components/canvas/CanvasGrid';
import { EDGE_TYPES, NODE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider, useDiagramGeometryPlan } from '@/components/canvas/edges/DiagramGeometryProvider';
import { GroupBackgroundLayer } from '@/components/canvas/GroupBackgroundLayer';
import { DEFAULT_EDGE_OPTIONS } from '@/lib/config';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { decodeSvgDataUrl, prepareReactFlowForImageExport, reactFlowExportFilter } from '@/lib/diagram/export/prepareReactFlowForImageExport';
import { maxRasterScale, rasterizeExportSvg } from '@/lib/diagram/export/rasterizeSvg';
import { safeToSvg } from '@/lib/diagram/export/safeHtmlToImage';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import type { CanvasBackgroundConfig } from '@/store/diagram/types';

interface CaptureOptions {
  nodes: Node[];
  edges: Edge[];
  view: CanvasHost & Required<Pick<CanvasHost, 'renderStyleId' | 'isDark'>>;
  background: CanvasBackgroundConfig;
  showGrid: boolean;
  gridOpacity?: number;
  surfaceColor?: string;
  transparent?: boolean;
  showGroupPlates?: boolean;
}

function CaptureReady({ onReady, needsNodes, needsRoutes }: {
  onReady: () => void;
  needsNodes: boolean;
  needsRoutes: boolean;
}) {
  const nodesInitialized = useNodesInitialized();
  const plan = useDiagramGeometryPlan();
  useEffect(() => {
    if ((!needsNodes || nodesInitialized) && (!needsRoutes || (plan && !plan.provisional))) onReady();
  }, [needsNodes, needsRoutes, nodesInitialized, plan, onReady]);
  return null;
}

function CaptureCanvas({ nodes, edges, view, background, showGrid, gridOpacity, transparent, showGroupPlates, onReady, onInit }: CaptureOptions & {
  onReady: () => void;
  onInit: (instance: ReactFlowInstance) => void;
}) {
  const id = useId();
  const { isDark } = view;
  const { cssVars, renderStyleId } = resolveCanvasTokens({ renderStyleId: view.renderStyleId, colorThemeId: view.colorThemeId, isDark });
  const fill = background.bgColor ?? cssVars['--arch-canvas-bg'];

  return (
    <div data-render-style={renderStyleId} className={isDark ? 'dark diagram-chrome-present' : 'diagram-chrome-present'}
      style={{ ...cssVars, width: '100%', height: '100%', '--arch-canvas-bg': fill } as CSSProperties}>
      <ReactFlowProvider>
        <CanvasHostProvider value={view}>
          <DiagramGeometryProvider nodes={nodes} edges={edges} isolated>
            <ReactFlow
              id={id}
              nodes={nodes}
              edges={edges}
              onInit={onInit}
              minZoom={0.0001}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              defaultMarkerColor={cssVars['--arch-edge-primary']}
              proOptions={{ hideAttribution: true }}
            >
              {showGroupPlates && <GroupBackgroundLayer />}
              {showGrid && <CanvasGrid background={background} isDark={isDark} gridColor={cssVars['--arch-canvas-grid']} transparent={transparent} opacity={gridOpacity} />}
              <SVGEdgeMarkerDefs />
              <CaptureReady onReady={onReady} needsNodes={nodes.some((node) => !node.hidden)} needsRoutes={edges.some((edge) => !edge.hidden)} />
            </ReactFlow>
          </DiagramGeometryProvider>
        </CanvasHostProvider>
      </ReactFlowProvider>
    </div>
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function captureBounds(flow: HTMLElement) {
  const root = flow.getBoundingClientRect();
  const content = flow.querySelectorAll('.react-flow__node, .react-flow__edge-path, [data-edge-label]');
  if (content.length === 0) return { x: 0, y: 0, width: 800, height: 600 };

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const element of content) {
    const box = element.getBoundingClientRect();
    left = Math.min(left, box.left - root.left);
    top = Math.min(top, box.top - root.top);
    right = Math.max(right, box.right - root.left);
    bottom = Math.max(bottom, box.bottom - root.top);
  }
  const padding = 50;
  const x = Math.floor(left) - padding;
  const y = Math.floor(top) - padding;
  return { x, y, width: Math.ceil(right) + padding - x, height: Math.ceil(bottom) + padding - y };
}

export async function captureDiagram(options: CaptureOptions) {
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.inert = true;
  Object.assign(mount.style, { position: 'fixed', left: '-100000px', top: '0', width: '800px', height: '600px' });
  document.body.append(mount);
  const root = createRoot(mount);
  let timeout: number | undefined;

  try {
    const nodes = options.nodes.map((node) => ({ ...node, selected: false, dragging: false }));
    const edges = options.edges.map((edge) => ({ ...edge, selected: false, animated: false }));
    const view = { ...options.view, readOnly: true, nodes, edges };
    const instance = await new Promise<ReactFlowInstance>((resolve, reject) => {
      let flow: ReactFlowInstance | undefined;
      let ready = false;
      const finish = () => { if (ready && flow) resolve(flow); };
      timeout = window.setTimeout(() => reject(new Error('Export canvas could not finish drawing')), 12_000);
      root.render(<CaptureCanvas {...options} nodes={nodes} edges={edges} view={view}
        onInit={(current) => { flow = current; finish(); }} onReady={() => { ready = true; finish(); }} />);
    });
    clearTimeout(timeout);
    await document.fonts.ready;
    await nextFrame();
    const flow = mount.querySelector<HTMLElement>('.react-flow');
    if (!flow) throw new Error('Export canvas is unavailable');

    const bounds = captureBounds(flow);
    const zoom = Math.min(1, maxRasterScale(bounds.width, bounds.height));
    const width = Math.ceil(bounds.width * zoom);
    const height = Math.ceil(bounds.height * zoom);
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    instance.setViewport({ x: -bounds.x * zoom, y: -bounds.y * zoom, zoom });
    await nextFrame();
    await nextFrame();

    prepareReactFlowForImageExport(flow);
    // html-to-image rounds computed font sizes. Preserve the exact font size on
    // each element before it snapshots the remaining computed styling.
    for (const element of [flow, ...flow.querySelectorAll<HTMLElement>('*')]) {
      if (element.style) element.style.fontSize = getComputedStyle(element).fontSize;
    }
    const styleProperties = Array.from(getComputedStyle(flow)).filter((name) => name !== 'font-size');
    const { cssVars } = resolveCanvasTokens({ renderStyleId: view.renderStyleId, colorThemeId: view.colorThemeId, isDark: view.isDark });
    const backgroundColor = options.transparent ? undefined : options.surfaceColor ?? options.background.bgColor ?? cssVars['--arch-canvas-bg'];
    const snapshot = await safeToSvg(flow, { width, height, backgroundColor, filter: reactFlowExportFilter, includeStyleProperties: styleProperties });
    const scale = Math.min(4, Math.max(3, Math.ceil(window.devicePixelRatio * 2)));
    return await rasterizeExportSvg(decodeSvgDataUrl(snapshot), scale);
  } finally {
    clearTimeout(timeout);
    root.unmount();
    mount.remove();
  }
}
