'use client';

import { useCallback, useMemo, type CSSProperties } from 'react';
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
  colorThemeId: 'default',
  isDark: false,
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
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 10, height: 10 },
  style: { stroke: color, strokeWidth: 1.4 },
  data: { label, pathType: 'Smoothstep', sourceSide: 'right', targetSide: 'left', labelPlacement: 'midpoint' },
});

const RAW_EDGES: Edge[] = [
  edge('landing-request', 'landing-client', 'landing-api', 'HTTPS', '#64748b'),
  edge('landing-queue', 'landing-api', 'landing-worker', 'ENQUEUE', '#b45309'),
  edge('landing-data', 'landing-api', 'landing-database', 'QUERY', '#475569'),
];

function useLayoutedGraph() {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 120, ranksep: 120, marginx: 20, marginy: 20 });
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
    return { nodes, edges: RAW_EDGES };
  }, []);
}

function Canvas() {
  const { nodes: initialNodes, edges: initialEdges } = useLayoutedGraph();
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    requestAnimationFrame(() => instance.fitView({ padding: 0.18, duration: 0 }));
  }, []);

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
      fitViewOptions={{ padding: 0.18, duration: 0 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d9dfdc" />
    </ReactFlow>
  );
}

export function LandingCanvasPreview() {
  return (
    <div
      className={styles.preview}
      aria-label="An ArchDraw canvas preview showing a web application, API gateway, job worker, and Postgres database."
      data-render-style="precision"
      data-color-theme="default"
      style={PREVIEW_CANVAS_TOKENS}
    >
      <div className={styles.chrome}>
        <span className={styles.windowControls}><i /><i /><i /></span>
        <span className={styles.canvasName}>Production architecture</span>
        <span className={styles.canvasStatus}><i /> live canvas</span>
      </div>
      <div className={styles.canvas}><ReactFlowProvider><Canvas /></ReactFlowProvider></div>
      <div className={styles.caption}><span>EXAMPLE CANVAS</span><span>EDITABLE</span></div>
    </div>
  );
}
