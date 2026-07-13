'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlowProvider,
  ConnectionLineType, Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { SVGEdgeMarkerDefs } from '@/lib/utils/edgeColorUtils';
import { useDiagramStore } from '@/store/diagramStore';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { assignEdgeColors } from '@/lib/edgeColors';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';

interface SharedCanvas {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

function Viewer({ canvas }: { canvas: SharedCanvas }) {
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);



  // We must call hooks unconditionally. Compute coloredEdges even if canvas is undefined,
  // returning an empty array as a safe fallback.
  const coloredEdges = useMemo(() => {
    if (!canvas || !canvas.edges) return [];
    return assignEdgeColors(canvas.edges as Edge[]);
  }, [canvas]);

  // Now we can safely exit early if the canvas is missing (e.g. invalid share ID)
  // This prevents the runtime 'Cannot read properties of undefined' error while rendering.
  if (!canvas) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f172a] text-white">
        <p>Canvas not found or has no data.</p>
      </div>
    );
  }

  const doDownload = async () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    setIsDownloading(true);

    try {
      const isDark = true;
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
      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${canvas.canvas_name}-${Date.now()}.png`;
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
    setShowEmailCapture(true);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}>
      {/* Top banner */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2.5 bg-[#0f172a]/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded-md flex items-center justify-center">
            <div className="w-2 h-2 border border-white/80 rounded-sm" />
          </div>
          <span className="text-white font-semibold text-sm">Archflow</span>
          <span className="text-white/30 text-sm">·</span>
          <span className="text-white/60 text-sm truncate max-w-xs">{canvas.canvas_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">View only</span>
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Downloading…' : 'Download'}
          </button>
          <a
            href="/editor"
            className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md transition-colors font-medium"
          >
            Create your own →
          </a>
        </div>
      </div>

      {/* Downloaded banner */}
      {downloaded && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-green-500/15 border border-green-500/30 rounded-lg backdrop-blur-sm">
          <span className="text-green-400 text-xs font-medium">✅ Diagram downloaded!</span>
          <a href="/editor" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2">
            Start designing for free →
          </a>
        </div>
      )}

      {/* Canvas */}
      <ReactFlow
        nodes={canvas.nodes as never[]}
        edges={coloredEdges as never[]}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: DIAGRAM_CONSTANTS.edge.strokeWidth },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#475569" style={{ opacity: 0.6 }} />
        <Controls showInteractive={false} className="!bg-white !border-gray-200 !text-gray-800 !shadow-sm" />
        <SVGEdgeMarkerDefs />
        <MiniMap zoomable pannable className="!bg-card/90 !border !border-border/60 !rounded-lg" maskColor="rgba(0,0,0,0.04)" />
      </ReactFlow>

      {showEmailCapture && (
        <EmailCaptureModal
          reason="download"
          onClose={() => setShowEmailCapture(false)}
        />
      )}
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
