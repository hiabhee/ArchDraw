'use client';

import { useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EDGE_TYPES, NODE_TYPES } from '@/lib/constants/canvasTypes';
import '@/components/nodes/nodeStyles.css';
import styles from './LandingCanvasPreview.module.css';

const NODES: Node[] = [
  {
    id: 'landing-client',
    type: 'systemNode',
    position: { x: 10, y: 168 },
    draggable: false,
    selectable: false,
    data: {
      typeId: 'client', label: 'Web application', subtitle: 'Next.js client',
      serviceType: 'client', category: 'Client', layer: 'client', nodeWidth: 200, nodeHeight: 100,
    },
  },
  {
    id: 'landing-api',
    type: 'systemNode',
    position: { x: 275, y: 168 },
    draggable: false,
    selectable: false,
    data: {
      typeId: 'api', label: 'API gateway', subtitle: 'Auth + routes',
      serviceType: 'api', category: 'Compute', layer: 'compute', nodeWidth: 200, nodeHeight: 100,
    },
  },
  {
    id: 'landing-worker',
    type: 'systemNode',
    position: { x: 540, y: 48 },
    draggable: false,
    selectable: false,
    data: {
      typeId: 'service', label: 'Job worker', subtitle: 'Async processing',
      serviceType: 'service', category: 'Async', layer: 'async', nodeWidth: 200, nodeHeight: 100,
    },
  },
  {
    id: 'landing-database',
    type: 'systemNode',
    position: { x: 540, y: 282 },
    draggable: false,
    selectable: false,
    data: {
      typeId: 'database', label: 'Postgres', subtitle: 'Primary data store',
      serviceType: 'database', category: 'Data', layer: 'data', shape: 'cylinder', nodeWidth: 200, nodeHeight: 100,
    },
  },
];

const edge = (id: string, source: string, target: string, label: string, color: string): Edge => ({
  id,
  source,
  target,
  type: 'simpleFloating',
  label,
  sourceHandle: 'source-right',
  targetHandle: 'target-left',
  markerEnd: { type: MarkerType.ArrowClosed, color },
  style: { stroke: color, strokeWidth: 1.5 },
  data: { pathType: 'Smoothstep', sourceSide: 'right', targetSide: 'left' },
});

const EDGES: Edge[] = [
  edge('landing-request', 'landing-client', 'landing-api', 'HTTPS', '#64748b'),
  edge('landing-queue', 'landing-api', 'landing-worker', 'ENQUEUE', '#b45309'),
  edge('landing-data', 'landing-api', 'landing-database', 'QUERY', '#475569'),
];

function Canvas() {
  const onInit = useCallback((instance: ReactFlowInstance) => {
    requestAnimationFrame(() => instance.fitView({ padding: 0.18, duration: 0 }));
  }, []);

  return (
    <ReactFlow
      className={styles.flow}
      nodes={NODES}
      edges={EDGES}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onInit={onInit}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      fitView
      fitViewOptions={{ padding: 0.18, duration: 0 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d9dfdc" />
    </ReactFlow>
  );
}

export function LandingCanvasPreview() {
  return (
    <div className={styles.preview} aria-label="An ArchDraw canvas preview showing a web application, API gateway, job worker, and Postgres database.">
      <div className={styles.chrome}>
        <span className={styles.windowControls}><i /><i /><i /></span>
        <span className={styles.canvasName}>Production architecture</span>
        <span className={styles.canvasStatus}><i /> live canvas</span>
      </div>
      <div className={styles.canvas}><ReactFlowProvider><Canvas /></ReactFlowProvider></div>
      <div className={styles.caption}><span>GENERATED FROM REPOSITORY</span><span>EDITABLE</span></div>
    </div>
  );
}
