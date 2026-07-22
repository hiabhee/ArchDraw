'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Type, Database, Server, Zap, Globe, Activity, Shield, Maximize2, Minimize2, Copy, Circle } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';

const TIER_ICONS: Record<string, React.ElementType> = {
  client: Globe,
  edge: Shield,
  compute: Server,
  async: Zap,
  data: Database,
  observe: Activity,
};

const TECH_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',
  sqs: 'Amazon SQS',
  react: 'React',
  nextjs: 'Next.js',
  nodejs: 'Node.js',
  python: 'Python',
  golang: 'Go',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  aws: 'AWS',
  nginx: 'Nginx',
  grafana: 'Grafana',
  prometheus: 'Prometheus',
  lambda: 'AWS Lambda',
  service: 'Service',
  database: 'Database',
  queue: 'Queue',
  cache: 'Cache',
  gateway: 'Gateway',
  loadbalancer: 'Load Balancer',
  auth: 'Authentication',
  firewall: 'Firewall',
  monitoring: 'Monitoring',
  external: 'External',
};

function EdgePropertiesPanel() {
  const { selectedEdgeId, edges, updateEdgeLabel, setSelectedEdgeId } = useDiagramStore();
  const edge = edges.find((e) => e.id === selectedEdgeId);
  const [localLabel, setLocalLabel] = useState(edge?.data?.label ?? '');
  const [prevEdge, setPrevEdge] = useState(edge);

  if (edge !== prevEdge) {
    setPrevEdge(edge);
    setLocalLabel(edge?.data?.label ?? '');
  }

  if (!edge) return null;

  return (
    <div className="floating-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium">Edge Properties</span>
        <button 
          onClick={() => setSelectedEdgeId(null)} 
          className="floating-icon-btn !w-8 !h-8"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Double-click the edge on canvas to add a label.
        </p>
        
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
            Label
          </label>
          <input
            type="text"
            value={localLabel}
            placeholder="e.g. calls API"
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => {
              if (selectedEdgeId) updateEdgeLabel(selectedEdgeId, localLabel);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (selectedEdgeId) updateEdgeLabel(selectedEdgeId, localLabel);
                (e.target as HTMLTextAreaElement).blur();
              }
              e.stopPropagation();
            }}
            className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const {
    selectedNodeId, nodes, updateNodeData, updateNodeSize, removeNode, setSelectedNodeId,
    selectedEdgeId,
  } = useDiagramStore();

  const node = nodes.find((n) => n.id === selectedNodeId);

  const labelRef = useRef<HTMLInputElement>(null);
  const [localLabel, setLocalLabel] = useState(node?.data?.label ?? '');
  const [prevNode, setPrevNode] = useState(node);

  if (node !== prevNode) {
    setPrevNode(node);
    setLocalLabel(node?.data?.label ?? '');
  }

  if (selectedEdgeId && !node) {
    return <EdgePropertiesPanel />;
  }

  if (!node) return null;

  const data = node.data;
  const TierIcon = TIER_ICONS[data.category?.toLowerCase()] || Server;
  const techLabel = data.tech ? TECH_LABELS[data.tech.toLowerCase()] || data.tech : null;

  const commitLabel = () => {
    if (localLabel.trim()) updateNodeData(node.id, { label: localLabel.trim() });
  };

  const handleDuplicate = () => {
    const newId = `${node.id}-copy-${Date.now()}`;
    useDiagramStore.getState().addNode({
      ...node,
      id: newId,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data, label: `${node.data.label} (copy)` },
    });
    useDiagramStore.getState().setSelectedNodeIds([newId]);
  };

  const handleStatusChange = () => {
    const statuses: Array<'healthy' | 'warning' | 'error' | 'unknown'> = ['healthy', 'warning', 'error', 'unknown'];
    const currentIndex = statuses.indexOf(data.status || 'healthy');
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    updateNodeData(node.id, { status: nextStatus });
  };

  const handleColorChange = () => {
    const colors = [
      '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#6b7280',
      '#f43f5e', '#a855f7', '#84cc16', '#fb923c', '#14b8a6',
    ];
    const currentIndex = colors.indexOf(data.accentColor || data.color || '#3b82f6');
    const nextColor = colors[(currentIndex + 1) % colors.length];
    updateNodeData(node.id, { accentColor: nextColor });
  };

  const statusColor = data.status === 'warning' ? '#F59E0B' : data.status === 'error' ? '#EF4444' : data.status === 'unknown' ? '#6B7280' : '#10B981';
  const accent = data.accentColor || data.color || '#3b82f6';

  return (
    <div 
      className="floating-panel p-4 overflow-y-auto"
      style={{ 
        minWidth: 260,
        position: 'fixed',
        top: 96,
        right: 20,
        bottom: 110,
        maxHeight: 'calc(100vh - 206px)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium">Node Info</span>
        <div className="flex items-center gap-1">
          <button onClick={handleDuplicate} title="Duplicate" className="floating-icon-btn !w-8 !h-8">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={handleStatusChange} title="Toggle Status" className="floating-icon-btn !w-8 !h-8">
            <Circle className="w-3 h-3" fill={statusColor} />
          </button>
          <button onClick={handleColorChange} title="Change Color" className="floating-icon-btn !w-8 !h-8">
            <Circle className="w-3 h-3" fill={accent} />
          </button>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="floating-icon-btn !w-8 !h-8"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        {/* Label */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
            <Type className="w-3 h-3" />
            Label
          </label>
          <input
            ref={labelRef}
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') labelRef.current?.blur(); e.stopPropagation(); }}
            className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-[#1E90FF]/30"
          />
        </div>

        {/* Category / Tier */}
        {data.category && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
              <TierIcon className="w-3 h-3" />
              Tier
            </label>
            <div className="px-3 py-2 text-xs bg-secondary rounded-xl capitalize">
              {data.category}
            </div>
          </div>
        )}

        {/* Technology */}
        {(data.tech || data.technology) && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Technology
            </label>
            <div className="px-3 py-2 text-xs bg-secondary rounded-xl">
              {techLabel || data.technology || data.tech}
            </div>
          </div>
        )}

        {/* Subtitle / Description */}
        {(data.sublabel || data.description) && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Description
            </label>
            <div className="px-3 py-2 text-xs bg-secondary rounded-xl text-muted-foreground">
              {data.sublabel || data.description}
            </div>
          </div>
        )}

        {/* Component Type */}
        {data.componentType && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Type
            </label>
            <div className="px-3 py-2 text-xs bg-secondary rounded-xl capitalize">
              {data.componentType}
            </div>
          </div>
        )}

        {/* Dimensions - only for groups */}
        {data.isGroup && (
          <div className="space-y-3">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
              <Maximize2 className="w-3 h-3" />
              Dimensions
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Width</span>
                <input
                  type="number"
                  value={node.width || 180}
                  onChange={(e) => {
                    const w = parseInt(e.target.value) || 180;
                    updateNodeSize(node.id, { width: w });
                  }}
                  className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-[#1E90FF]/30"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Height</span>
                <input
                  type="number"
                  value={node.height || 100}
                  onChange={(e) => {
                    const h = parseInt(e.target.value) || 100;
                    updateNodeSize(node.id, { height: h });
                  }}
                  className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-[#1E90FF]/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* Node ID (for reference) */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
            ID
          </label>
          <div className="px-3 py-2 text-xs bg-secondary rounded-xl text-muted-foreground font-mono truncate" title={node.id}>
            {node.id}
          </div>
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-border/50">
          <button
            onClick={() => { removeNode(node.id); setSelectedNodeId(null); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Delete Node
          </button>
        </div>
      </div>
    </div>
  );
}
