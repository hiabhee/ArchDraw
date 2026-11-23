'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  ConnectionLineType,
  ConnectionMode,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useHoverFocus } from '@/lib/diagram/canvas/useHoverFocus';
import { SELECTION_FOCUS_CLASS } from '@/lib/diagram/canvas/selectionFocus';
import { Download, Save, Sun, Moon, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { assignEdgeColors } from '@/lib/theme/edgeColors';
import { edgeThemeInk } from '@/lib/theme/edgeInk';
import type { LayoutDirection } from '@/lib/diagram/mermaid/relayout';
import { resolveCanvasTokens, ensureSketchFontLoaded, ensureRenderStyleFontLoaded, type DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import { sketchHandwritingFont } from '@/lib/theme/renderStyles/sketchFont';
import { NODE_TYPES, EDGE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider } from '@/components/canvas/edges/DiagramGeometryProvider';
import { CANVAS_CONFIG, DEFAULT_CANVAS_BACKGROUND, DEFAULT_EDGE_OPTIONS } from '@/lib/config';
import { CanvasGrid } from '@/components/canvas/CanvasGrid';
import { useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme/appTheme';
import '@/components/canvas/nodes/nodeStyles.css';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { previewCopyUrl } from '@/lib/diagram/canvas/previewCopy';
import { BrandMark } from '@/components/ui/BrandMark';
import { pngDataUrlToBlob } from '@/lib/diagram/export/prepareReactFlowForImageExport';

interface SharedCanvas {
  id: string;
  canvas_name: string;
  isMcpPreview?: boolean;
  direction?: LayoutDirection;
  originalPositions?: Pick<Node, 'id' | 'position'>[];
  nodes: unknown[];
  edges: unknown[];
}

function normalizeNodes(raw: unknown[]): Node[] {
  return (raw || []).map((n) => {
    const node = n as Node;
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;
    return {
      ...node,
      selected: false,
      dragging: false,
      ...(isGroup ? { zIndex: -1 } : {}),
    };
  });
}

function normalizeEdges(raw: unknown[]): Edge[] {
  return (raw || []).map((e) => {
    const edge = e as Edge;
    return {
      ...edge,
      selected: false,
      type: edge.type || DEFAULT_EDGE_OPTIONS.type,
    };
  });
}

function Viewer({ canvas }: { canvas: SharedCanvas }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const { isDark, setTheme } = useTheme();
  const { fitView, getNodes, getEdges, getZoom } = useReactFlow();
  const viewerRef = useRef<HTMLDivElement>(null);
  const editablePreview = Boolean(canvas.isMcpPreview);
  const searchParams = useSearchParams();

  // Preserve the creator's render style (if any) from the share URL.
  // Read in an effect (not a state initializer) so SSR/hydration always
  // agree on the first render.
  const [renderStyle, setRenderStyle] = useState<DiagramRenderStyleId>('studio-minimal');

  useEffect(() => {
    const style = new URLSearchParams(window.location.search).get('style');
    // Read the URL after hydration to keep the server and first client render identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (style === 'sketch') setRenderStyle('sketch');
    else if (style === 'neubrutalism') setRenderStyle('neubrutalism');
    else if (style === 'studio-minimal') setRenderStyle('studio-minimal');
    else if (style === 'studio-metallic') setRenderStyle('studio-metallic');
    else if (style === 'precision') setRenderStyle('precision');
  }, []);

  // The shared diagram's look is passed to nodes via CanvasHostProvider below.
  // It used to be written into the (persisted) editor store, which permanently
  // replaced the visitor's own render-style preference.
  useEffect(() => {
    if (renderStyle === 'sketch') {
      ensureSketchFontLoaded();
    } else {
      ensureRenderStyleFontLoaded(renderStyle);
    }
  }, [renderStyle]);

  const { cssVars: themeVars, colors } = useMemo(
    () => resolveCanvasTokens({
      renderStyleId: renderStyle,
      colorThemeId: renderStyle === 'studio-minimal' || renderStyle === 'studio-metallic' ? 'studio-minimal' : 'slate',
      isDark,
    }),
    [renderStyle, isDark],
  );

  const initialNodes = useMemo(
    () => normalizeNodes((canvas?.nodes as unknown[]) || []),
    [canvas]
  );
  const [previewNodes, , onNodesChange] = useNodesState(initialNodes);
  const nodes = editablePreview ? previewNodes : initialNodes;
  const edges = useMemo(
    () => normalizeEdges((canvas?.edges as unknown[]) || []),
    [canvas]
  );

  // View-only layout direction (LR/TB) via the canonical Mermaid→Dagre
  // path. Always re-layouts from the shared base graph (never compounds),
  // caches per canvas + direction, and never writes back to the store.
  const canvasId = canvas?.id;
  const layoutDir: LayoutDirection = canvas.direction ?? (searchParams.get('direction') === 'TD' ? 'TD' : 'LR');

  const displayedNodes = nodes;
  const displayedEdges = useMemo(
    () => assignEdgeColors(edges, isDark, renderStyle === 'sketch', edgeThemeInk(colors)),
    [edges, isDark, renderStyle, colors],
  );
  const hoverFocus = useHoverFocus(displayedNodes, displayedEdges);

  const canvasHost = useMemo<CanvasHost>(() => ({
    readOnly: true,
    nodes: displayedNodes,
    edges: displayedEdges,
    renderStyleId: renderStyle,
    colorThemeId: renderStyle === 'studio-minimal' || renderStyle === 'studio-metallic' ? 'studio-minimal' : 'slate',
    direction: layoutDir,
    isDark,
    planKey: `share:${canvasId ?? 'none'}`,
  }), [displayedNodes, displayedEdges, renderStyle, layoutDir, isDark, canvasId]);

  if (!canvas) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-[hsl(var(--canvas-bg))] text-foreground">
        <p>Canvas not found or has no data.</p>
      </div>
    );
  }

  const doDownload = async () => {
    setIsDownloading(true);

    try {
      const { captureDiagram } = await import('@/lib/diagram/export/captureDiagram');
      const { dataUrl } = await captureDiagram({
        nodes: getNodes(),
        edges: getEdges(),
        view: { ...canvasHost, renderStyleId: renderStyle, isDark, labelZoom: getZoom() },
        background: {
          variant: 'dots',
          gap: CANVAS_CONFIG.background.gap,
          size: CANVAS_CONFIG.background.size,
          patternColor: isDark ? '#475569' : '#cbd5e1',
          bgColor: null,
        },
        surfaceColor: viewerRef.current ? getComputedStyle(viewerRef.current).backgroundColor : undefined,
        showGrid: true,
        gridOpacity: 0.6,
      });
      let blob: Blob | null = null;
      try {
        blob = pngDataUrlToBlob(dataUrl);
      } catch {
        // Fallback to direct data URL download
        const a2 = document.createElement('a');
        a2.href = dataUrl;
        a2.download = `${canvas.canvas_name || 'diagram'}-${Date.now()}.png`;
        a2.style.display = 'none';
        document.body.appendChild(a2);
        a2.click();
        setTimeout(() => a2.remove(), 1000);
        toast.success('Downloaded!');
        setDownloaded(true);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${canvas.canvas_name || 'diagram'}-${Date.now()}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      toast.success('Downloaded!');
      setDownloaded(true);
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadClick = () => {
    void doDownload();
  };

  return (
    <div
      ref={viewerRef}
      className={`${isDark ? 'dark' : ''} w-screen h-[100dvh] bg-[hsl(var(--canvas-bg))] text-foreground ${renderStyle === 'sketch' ? sketchHandwritingFont.className : ''}`}
      style={{ ...themeVars, ...(editablePreview ? { backgroundColor: themeVars['--arch-canvas-bg'] } : {}) } as React.CSSProperties}
      data-render-style={renderStyle}
    >
      {/* Floating preview controls share the canvas background. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={20} className="rounded-md" />
          <span className="font-semibold text-sm">ArchDraw</span>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-muted-foreground text-sm truncate max-w-xs">
            {canvas.canvas_name}
          </span>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {!editablePreview && <span className="text-muted-foreground text-xs hidden sm:inline">View only</span>}
          <span className="hidden md:inline text-xs text-muted-foreground tabular-nums">
            {nodes.length} nodes · {edges.length} edges
          </span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-pressed={isDark}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition duration-150 bg-secondary hover:bg-secondary/80 border border-border/40"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
          <button
            onClick={() => fitView({ padding: 0.15, duration: 300 })}
            className="w-8 h-8 rounded-lg hidden sm:flex items-center justify-center transition duration-150 bg-secondary hover:bg-secondary/80 border border-border/40"
            title="Fit diagram to screen"
            aria-label="Fit diagram to screen"
          >
            <Maximize className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Downloading…' : 'Download'}
          </button>
          {editablePreview ? (
            <button
              type="button"
              onClick={() => {
                const url = previewCopyUrl(window.location.href, crypto.randomUUID(), canvas.originalPositions ?? initialNodes, getNodes());
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80"
              aria-label="Save to ArchDraw"
            >
              <Save className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Save to ArchDraw</span>
            </button>
          ) : (
            <a href="/editor" className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-secondary/80">
              Open editor
            </a>
          )}
        </div>
      </div>

      {downloaded && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-green-500/15 border border-green-500/30 rounded-lg backdrop-blur-sm">
          <span className="text-green-400 text-xs font-medium">Diagram downloaded!</span>
          <a
            href="/editor"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
          >
            Start designing for free →
          </a>
        </div>
      )}

      <div className={`w-full h-full${hoverFocus.css ? ` ${SELECTION_FOCUS_CLASS}` : ''}`}>
        {hoverFocus.css && <style>{hoverFocus.css}</style>}
        {editablePreview && (
          <select
            aria-label="Diagram style"
            value={renderStyle === 'studio-minimal' || renderStyle === 'studio-metallic' ? renderStyle : ''}
            onChange={(event) => setRenderStyle(event.target.value === 'studio-metallic' ? 'studio-metallic' : 'studio-minimal')}
            className="absolute bottom-4 left-16 z-10 cursor-pointer rounded-md bg-surface-page px-2 py-1.5 text-xs text-text-primary hover:bg-secondary"
          >
            {renderStyle !== 'studio-minimal' && renderStyle !== 'studio-metallic' && <option value="" disabled>Shared style</option>}
            <option value="studio-minimal">Studio Minimal</option>
            <option value="studio-metallic">Studio Metallic</option>
          </select>
        )}
        <CanvasHostProvider value={canvasHost}>
        <DiagramGeometryProvider nodes={nodes} edges={displayedEdges}>
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeMouseEnter={hoverFocus.onNodeMouseEnter}
          onNodeMouseLeave={hoverFocus.onNodeMouseLeave}
          nodesDraggable={editablePreview}
          onNodesChange={editablePreview ? onNodesChange : undefined}
          deleteKeyCode={null}
          nodesConnectable={false}
          elementsSelectable={true}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          panOnDrag
          // Dragging the background pans, and dragging a preview node moves it locally.
          zoomOnScroll
          zoomOnPinch
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={CANVAS_CONFIG.minZoom}
          maxZoom={CANVAS_CONFIG.maxZoom}
          defaultMarkerColor={themeVars['--arch-edge-primary']}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        >
          {editablePreview ? <CanvasGrid background={DEFAULT_CANVAS_BACKGROUND} isDark={isDark} gridColor={themeVars['--arch-canvas-grid']} /> : <Background
            variant={BackgroundVariant.Dots}
            gap={CANVAS_CONFIG.background.gap}
            size={CANVAS_CONFIG.background.size}
            color={isDark ? '#475569' : '#cbd5e1'}
            style={{ opacity: 0.6 }}
          />}
          <Controls
            showInteractive={false}
            className="!bg-card !border-border !text-foreground !shadow-sm"
          />
          <SVGEdgeMarkerDefs />
          <MiniMap
            zoomable
            pannable
            className="!bg-card/90 !border !border-border/60 !rounded-lg"
            maskColor={isDark ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.06)'}
          />
        </ReactFlow>
        </DiagramGeometryProvider>
        </CanvasHostProvider>
      </div>
    </div>
  );
}

export function SharedCanvasViewer({ canvas }: { canvas: SharedCanvas }) {
  return (
    <ReactFlowProvider>
      <Viewer key={canvas.id} canvas={canvas} />
    </ReactFlowProvider>
  );
}
