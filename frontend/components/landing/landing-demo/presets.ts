import { MarkerType } from 'reactflow';
import type { PresetData } from './demoTypes';

export const PRESETS: Record<'loadBalancer', PresetData> = {
  loadBalancer: {
    title: 'Describe simple load balancer...',
    nodes: [
      // Containers — generous vertical gaps so groups / edges do not feel packed
      { id: 'CLIENT_GROUP', type: 'demoGroup', position: { x: 460, y: 40 }, style: { width: 360, height: 160 }, data: { label: 'CLIENT CONTAINER', color: '#6366f1' }, draggable: true },
      { id: 'LB_GROUP', type: 'demoGroup', position: { x: 460, y: 280 }, style: { width: 360, height: 160 }, data: { label: 'LOAD BALANCER', color: '#22c55e' }, draggable: true },
      { id: 'SERVER_GROUP', type: 'demoGroup', position: { x: 40, y: 520 }, style: { width: 1200, height: 160 }, data: { label: 'SERVER POOL', color: '#a855f7' }, draggable: true },
      // Nodes
      { id: 'client-node', type: 'demoNode', parentId: 'CLIENT_GROUP', position: { x: 80, y: 44 }, data: { label: 'Client', subtitle: 'Web Browser / iOS', layer: 'client', icon: '🌐' }, draggable: true },
      { id: 'lb-node', type: 'demoNode', parentId: 'LB_GROUP', position: { x: 80, y: 44 }, data: { label: 'Load Balancer', subtitle: 'Nginx Proxy', layer: 'edge', icon: '⚡' }, draggable: true },
      { id: 'server1', type: 'demoNode', parentId: 'SERVER_GROUP', position: { x: 80, y: 44 }, data: { label: 'Server 1', subtitle: 'Node.js App', layer: 'compute', icon: '💻' }, draggable: true },
      { id: 'server2', type: 'demoNode', parentId: 'SERVER_GROUP', position: { x: 500, y: 44 }, data: { label: 'Server 2', subtitle: 'Go Microservice', layer: 'compute', icon: '💻' }, draggable: true },
      { id: 'server3', type: 'demoNode', parentId: 'SERVER_GROUP', position: { x: 920, y: 44 }, data: { label: 'Monitoring Service', subtitle: 'Prometheus', layer: 'observe', icon: '📊' }, draggable: true },
      // Invisible spacer node to push content up so the floating AI bar has background
      {
        id: 'dummy-spacer',
        type: 'spacerNode',
        position: { x: 500, y: 780 },
        data: {},
        draggable: false,
        selectable: false,
        deletable: false,
      },
      // Invisible spacer node to push content down so the top bar has background
      {
        id: 'dummy-spacer-top',
        type: 'spacerNode',
        position: { x: 500, y: -80 },
        data: {},
        draggable: false,
        selectable: false,
        deletable: false,
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'client-node',
        target: 'lb-node',
        label: 'HTTPS REQUEST',
        type: 'straight',
        className: 'flow-dotted-edge',
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' }
      },
      {
        id: 'e2',
        source: 'lb-node',
        target: 'server1',
        label: 'ROUTE REQUEST',
        type: 'straight',
        className: 'flow-dotted-edge',
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' }
      },
      {
        id: 'e3',
        source: 'lb-node',
        target: 'server2',
        label: 'ROUTE REQUEST',
        type: 'straight',
        className: 'flow-dotted-edge',
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' }
      },
      {
        id: 'e4',
        source: 'lb-node',
        target: 'server3',
        label: 'HEALTH METRICS',
        type: 'straight',
        className: 'flow-dotted-edge',
        style: { stroke: '#475569', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' }
      },
    ],
  },
};
