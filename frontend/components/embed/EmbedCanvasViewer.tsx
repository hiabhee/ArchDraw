'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  ConnectionLineType,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EDGE_TYPE_CONFIGS } from '@/data/edgeTypes';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { assignEdgeColors } from '@/lib/edgeColors';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
import { useDiagramStore } from '@/store/diagramStore';
import '@/components/nodes/nodeStyles.css';

interface EmbedCanvasProps {
  nodes: Node[];
  edges: Edge[];
  theme?: 'dark' | 'light';
  zoom?: number;
  showControls?: boolean;
  pathType?: 'smooth' | 'step' | 'straight' | 'bezier';
}

function EmbedCanvasInner({ nodes, edges, theme = 'dark', zoom = 1, showControls = true, pathType = 'smooth' }: EmbedCanvasProps) {
  const { fitView } = useReactFlow();
  const isDark = theme === 'dark';
  
  const backgroundColor = isDark ? '#0f172a' : '#ffffff';
  const gridColor = isDark ? '#475569' : '#64748b';
  const gridOpacity = isDark ? 0.6 : 0.4;
  const controlBg = isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const controlBorder = isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)';
  
  const pathTypeConfig: Record<string, { borderRadius?: number }> = useMemo(() => ({
    smooth: { borderRadius: 24 },
    bezier: {},
    step: { borderRadius: 0 },
    straight: {},
  }), []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    useDiagramStore.setState({ darkMode: isDark });
  }, [isDark]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  const coloredEdges = useMemo(() => assignEdgeColors(edges, isDark), [edges, isDark]);

  return (
    <div className={isDark ? 'dark' : ''} style={{ width: '100%', height: '100%', background: backgroundColor }}>
      <ReactFlow
        nodes={nodes}
        edges={coloredEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
        panOnScroll={true}
        defaultViewport={{ x: 0, y: 0, zoom }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'floating',
          style: { strokeWidth: DIAGRAM_CONSTANTS.edge.strokeWidth },
        }}
      >
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <defs>
            {Object.values(EDGE_TYPE_CONFIGS).map((cfg) => (
              <g key={cfg.id}>
                <marker
                  id={`embed-marker-${cfg.id}-end`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill={cfg.color} />
                </marker>
                {cfg.markerStart && (
                  <marker
                    id={`embed-marker-${cfg.id}-start`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="0"
                    refY="3"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill={cfg.color} />
                  </marker>
                )}
              </g>
            ))}
          </defs>
        </svg>
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color={gridColor}
          style={{ opacity: gridOpacity }}
        />
        {showControls && (
          <Controls
            showInteractive={false}
            style={{
              background: controlBg,
              border: `1px solid ${controlBorder}`,
              borderRadius: '8px',
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

export function EmbedCanvasViewer({ nodes, edges, theme = 'dark', zoom = 1, showControls = true, pathType = 'smooth' }: EmbedCanvasProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', background: theme === 'dark' ? '#0f172a' : '#ffffff' }} />
    );
  }

  return (
    <ReactFlowProvider>
      <EmbedCanvasInner
        nodes={nodes}
        edges={edges}
        theme={theme}
        zoom={zoom}
        showControls={showControls}
        pathType={pathType}
      />
    </ReactFlowProvider>
  );
}

export type { EmbedCanvasProps };
