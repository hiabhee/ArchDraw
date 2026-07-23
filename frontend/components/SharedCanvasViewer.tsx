'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  ConnectionLineType,
  ConnectionMode,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, Sun, Moon } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { SVGEdgeMarkerDefs } from '@/lib/utils/edgeColorUtils';
import { useDiagramStore } from '@/store/diagramStore';
import { assignEdgeColors } from '@/lib/edgeColors';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
import { CANVAS_CONFIG, DEFAULT_EDGE_OPTIONS } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import '@/components/nodes/nodeStyles.css';

interface SharedCanvas {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

function normalizeNodes(raw: unknown[]): Node[] {
  return (raw || []).map((n) => {
    const node = n as Node;
    return {
      ...node,
      selected: false,
      dragging: false,
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

const dataUrlToBlob = (dataUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert to blob'));
        }
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

function Viewer({ canvas }: { canvas: SharedCanvas }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const { isDark, setTheme } = useTheme();
  const { fitView } = useReactFlow();

  const nodes = useMemo(
    () => normalizeNodes((canvas?.nodes as unknown[]) || []),
    [canvas]
  );
  const edges = useMemo(
    () => normalizeEdges((canvas?.edges as unknown[]) || []),
    [canvas]
  );
  const coloredEdges = useMemo(() => assignEdgeColors(edges, isDark), [edges, isDark]);

  // Sync darkMode in diagram store so node CSS picks up the theme
  useEffect(() => {
    useDiagramStore.setState({ darkMode: isDark });
  }, [isDark]);

  if (!canvas) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[hsl(var(--canvas-bg))] text-foreground">
        <p>Canvas not found or has no data.</p>
      </div>
    );
  }

  const doDownload = async () => {
    setIsDownloading(true);

    try {
      fitView({ padding: 0.1, duration: 300 });
      await new Promise((r) => setTimeout(r, 350));

      const el = document.querySelector('.react-flow') as HTMLElement | null;
      if (!el) {
        toast.error('Canvas not ready. Please try again.');
        return;
      }

      const dataUrl = await toPng(el, {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        pixelRatio: 3,
        cacheBust: true,
        filter: (node) => {
          const cls = (node as HTMLElement).classList;
          if (!cls) return true;
          return (
            !cls.contains('react-flow__minimap') &&
            !cls.contains('react-flow__controls') &&
            !cls.contains('react-flow__panel') &&
            !cls.contains('react-flow__background')
          );
        },
      });
      const blob = await dataUrlToBlob(dataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${canvas.canvas_name || 'diagram'}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
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
    <div className={`${isDark ? 'dark' : ''} w-screen h-screen bg-[hsl(var(--canvas-bg))] text-foreground`}>
      {/* Top banner */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2.5 bg-[hsl(var(--canvas-bg))]/95 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center">
            <div className="w-2 h-2 border border-white/80 rounded-sm" />
          </div>
          <span className="font-semibold text-sm">ArchDraw</span>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-muted-foreground text-sm truncate max-w-xs">
            {canvas.canvas_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">View only</span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 bg-secondary hover:bg-secondary/80 border border-border/40"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Downloading…' : 'Download'}
          </button>
          <a
            href="/editor"
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md transition-colors font-medium"
          >
            Create your own →
          </a>
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

      <div className="w-full h-full pt-12">
        <ReactFlow
          nodes={nodes}
          edges={coloredEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={CANVAS_CONFIG.minZoom}
          maxZoom={CANVAS_CONFIG.maxZoom}
          defaultMarkerColor="#1E2130"
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={CANVAS_CONFIG.background.gap}
            size={CANVAS_CONFIG.background.size}
            color={isDark ? '#475569' : '#cbd5e1'}
            style={{ opacity: 0.6 }}
          />
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
      </div>
    </div>
  );
}

export function SharedCanvasViewer({ canvas }: { canvas: SharedCanvas }) {
  return (
    <ReactFlowProvider>
      <Viewer canvas={canvas} />
    </ReactFlowProvider>
  );
}
