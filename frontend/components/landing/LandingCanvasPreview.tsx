'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NODE_TYPES, EDGE_TYPES } from '@/lib/constants/canvasTypes';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import dagre from 'dagre';
import '@/components/nodes/nodeStyles.css';
import styles from './LandingCanvasPreview.module.css';

const PREVIEW_CANVAS_TOKENS = resolveCanvasTokens({
  renderStyleId: 'precision',
  colorThemeId: 'slate',
  isDark: true,
}).cssVars as CSSProperties;

// Mirror the editor's precision canvas: same node types, edge types, theme tokens, and sizing.
// Synchronous layout via useMemo — no async setState on mount (avoids React 19 “state update on unmounted” warning).
function makeNode(id: string, label: string, subtitle: string, serviceType: string, category: string, layer: string, shape?: string): Node {
  const dims = calculateNodeDimensions(label, subtitle, { shape });
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
      shape,
      accentColor: '#91b8ff',
      nodeWidth: dims.width,
      nodeHeight: dims.height,
    },
  };
}

const RAW_NODES: Node[] = [
  makeNode('landing-client', 'Web application', 'Next.js client', 'client', 'Client', 'client'),
  makeNode('landing-api', 'API gateway', 'Auth + routes', 'api', 'Compute', 'compute'),
  makeNode('landing-worker', 'Job worker', 'Async processing', 'service', 'Async', 'async'),
  makeNode('landing-database', 'Postgres', 'Primary data store', 'database', 'Data', 'data', 'cylinder'),
];

const edge = (id: string, source: string, target: string, label: string, color: string): Edge => ({
  id,
  source,
  target,
  type: 'simpleFloating',
  sourceHandle: 'source-right',
  targetHandle: 'target-left',
  label,
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 10, height: 10 },
  style: { stroke: color, strokeWidth: 1.4 },
  data: { label, pathType: 'Smoothstep', sourceSide: 'right', targetSide: 'left', labelPlacement: 'midpoint' },
});

const RAW_EDGES: Edge[] = [
  edge('landing-request', 'landing-client', 'landing-api', 'HTTPS', '#69a8dc'),
  edge('landing-queue', 'landing-api', 'landing-worker', 'ENQUEUE', '#91b8ff'),
  edge('landing-data', 'landing-api', 'landing-database', 'QUERY', '#91b8ff'),
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

function useLayoutedGraph(direction: 'LR' | 'TB') {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    const isHorizontal = direction === 'LR';
    g.setGraph({
      rankdir: direction,
      nodesep: isHorizontal ? 120 : 20,
      ranksep: isHorizontal ? 120 : 48,
      marginx: 20,
      marginy: 20,
    });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of RAW_NODES) {
      const w = (n.width as number) ?? 200;
      const h = (n.height as number) ?? 72;
      g.setNode(n.id, { width: w, height: h });
    }
    for (const e of RAW_EDGES) g.setEdge(e.source, e.target);
    dagre.layout(g);
    const nodes: Node[] = RAW_NODES.map((n) => {
      const pos = g.node(n.id);
      const w = (n.width as number) ?? 200;
      const h = (n.height as number) ?? 72;
      return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
    });
    const edges = RAW_EDGES.map((e) => ({
      ...e,
      sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
      targetHandle: isHorizontal ? 'target-left' : 'target-top',
      data: {
        ...e.data,
        sourceSide: isHorizontal ? 'right' : 'bottom',
        targetSide: isHorizontal ? 'left' : 'top',
      },
    }));

    return { nodes, edges };
  }, [direction]);
}

function Canvas() {
  const isNarrow = useNarrowCanvas();
  const { nodes: layoutNodes, edges: layoutEdges } = useLayoutedGraph(isNarrow ? 'TB' : 'LR');
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setInstance(instance);
  }, []);

  useEffect(() => {
    if (!instance) return;
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    const frame = requestAnimationFrame(() => {
      instance.fitView({ padding: isNarrow ? 0.12 : 0.18, minZoom: 0.25, maxZoom: isNarrow ? 0.72 : 2, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [instance, isNarrow, layoutNodes, layoutEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      className={styles.flow}
      nodes={nodes}
      edges={edges}
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
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      selectNodesOnDrag
      proOptions={{ hideAttribution: true }}
      fitView
      minZoom={0.25}
      maxZoom={isNarrow ? 0.72 : 2}
      fitViewOptions={{ padding: isNarrow ? 0.12 : 0.18, minZoom: 0.25, maxZoom: isNarrow ? 0.72 : 2, duration: 0 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--arch-canvas-grid)" />
    </ReactFlow>
  );
}

export function LandingCanvasPreview() {
  return (
    <div
      className={`${styles.preview} dark`}
      aria-label="An ArchDraw canvas preview showing a web application, API gateway, job worker, and Postgres database."
      data-render-style="precision"
      data-color-theme="slate"
      style={PREVIEW_CANVAS_TOKENS}
    >
      <div className={styles.chrome}>
        <span className={styles.canvasName}>Example architecture</span>
        <span className={styles.canvasStatus}><i /> editable</span>
      </div>
      <div className={styles.canvas}><ReactFlowProvider><Canvas /></ReactFlowProvider></div>
    </div>
  );
}
