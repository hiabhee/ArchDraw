'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { X, Type, Database, Server, Zap, Globe, Activity, Shield, Maximize2, Copy, Circle, Square, Diamond, Cylinder as CylinderIcon, Disc, SlidersHorizontal, Inbox, GitBranch, Monitor, Box } from 'lucide-react';
import { useDiagramStore, type NodeData } from '@/store/diagramStore';
import type { ShapeType } from '@/components/ShapeNode';

const GROUP_COLOR_OPTIONS = [
  '#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6',
  '#3b82f6', '#06b6d4', '#eab308', '#f43f5e', '#64748b',
];

const SHAPE_OPTIONS: { value: ShapeType; label: string; icon: React.ElementType }[] = [
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'rounded-rectangle', label: 'Rounded', icon: Square },
  { value: 'diamond', label: 'Diamond', icon: Diamond },
  { value: 'cylinder', label: 'Cylinder', icon: CylinderIcon },
  { value: 'circle', label: 'Circle', icon: Disc },
  { value: 'parallelogram', label: 'Parallel', icon: SlidersHorizontal },
];

const TIER_ICONS: Record<string, React.ElementType> = {
  client: Globe,
  edge: Shield,
  compute: Server,
  async: Zap,
  data: Database,
  observe: Activity,
};

const COMPONENT_TYPE_OPTIONS = [
  { value: 'service', label: 'Service', icon: Box, shape: 'rounded-rectangle' as ShapeType, category: 'compute', color: '#4F46E5' },
  { value: 'database', label: 'Database', icon: Database, shape: 'cylinder' as ShapeType, category: 'data', color: '#1e293b' },
  { value: 'queue', label: 'Message Queue', icon: Inbox, shape: 'circle' as ShapeType, category: 'messaging', color: '#0891b2' },
  { value: 'load-balancer', label: 'Load Balancer', icon: GitBranch, shape: 'diamond' as ShapeType, category: 'networking', color: '#1E90FF' },
  { value: 'client', label: 'Client', icon: Monitor, shape: 'rounded-rectangle' as ShapeType, category: 'client', color: '#2563EB' },
  { value: 'external-service', label: 'External', icon: Globe, shape: 'diamond' as ShapeType, category: 'external', color: '#64748b' },
  { value: 'observability', label: 'Observability', icon: Activity, shape: 'rounded-rectangle' as ShapeType, category: 'observability', color: '#475569' },
  { value: 'api-gateway', label: 'API Gateway', icon: Shield, shape: 'diamond' as ShapeType, category: 'gateway', color: '#7c3aed' },
  { value: 'cache', label: 'Cache', icon: Zap, shape: 'cylinder' as ShapeType, category: 'data', color: '#f59e0b' },
  { value: 'function', label: 'Function', icon: Server, shape: 'rounded-rectangle' as ShapeType, category: 'compute', color: '#ec4899' },
  { value: 'cdn', label: 'CDN', icon: Globe, shape: 'circle' as ShapeType, category: 'edge', color: '#10b981' },
  { value: 'auth-service', label: 'Auth Service', icon: Shield, shape: 'rounded-rectangle' as ShapeType, category: 'security', color: '#6366f1' },
  { value: 'monitoring', label: 'Monitoring', icon: Activity, shape: 'rounded-rectangle' as ShapeType, category: 'observability', color: '#0ea5e9' },
  { value: 'container', label: 'Container', icon: Box, shape: 'rounded-rectangle' as ShapeType, category: 'compute', color: '#06b6d4' },
];

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
    selectedNodeId, selectedNodeIds, nodes, updateNodeSize, setSelectedNodeId, setSelectedNodeIds,
    selectedEdgeId,
  } = useDiagramStore();

  const isMulti = selectedNodeIds.length > 1 && !selectedNodeId;
  const targetIds = useMemo(
    () => isMulti ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []),
    [isMulti, selectedNodeId, selectedNodeIds]
  );

  const node = isMulti ? null : nodes.find((n) => n.id === selectedNodeId);

  const labelRef = useRef<HTMLInputElement>(null);
  const [localLabel, setLocalLabel] = useState(node?.data?.label ?? '');
  const [prevNode, setPrevNode] = useState(node);

  if (node !== prevNode) {
    setPrevNode(node);
    setLocalLabel(node?.data?.label ?? '');
  }

  // For multi-select, use the first node's data as a reference
  const firstData: NodeData | undefined = isMulti && targetIds.length > 0
    ? nodes.find((n) => n.id === targetIds[0])?.data
    : node?.data;
  const data: Partial<NodeData> = firstData ?? {};

  const applyToAll = useCallback((updates: Partial<NodeData>) => {
    const store = useDiagramStore.getState();
    store.pushHistory();
    for (const id of targetIds) {
      store.updateNodeData(id, updates);
    }
  }, [targetIds]);

  const applyTypeChange = useCallback((typeValue: string) => {
    const option = COMPONENT_TYPE_OPTIONS.find((o) => o.value === typeValue);
    if (!option) return;
    useDiagramStore.getState().pushHistory();
    for (const id of targetIds) {
      const existing = useDiagramStore.getState().nodes.find((n) => n.id === id);
      if (!existing) continue;
      const isSystemNode = existing.type === 'systemNode' || existing.type === 'architectureNode' || existing.type === 'baseNode';
      if (isSystemNode) {
        const newNode = {
          ...existing,
          type: 'shapeNode' as const,
          data: {
            ...existing.data,
            shape: option.shape,
            componentType: option.value,
            category: option.category,
            icon: option.icon.name,
            color: option.color,
            accentColor: option.color,
          },
        };
        useDiagramStore.getState().importDiagram(
          useDiagramStore.getState().nodes.map((n) => n.id === id ? newNode : n),
          useDiagramStore.getState().edges
        );
      } else {
        useDiagramStore.getState().updateNodeData(id, {
          shape: option.shape,
          componentType: option.value,
          category: option.category,
          icon: option.icon.name,
          color: option.color,
          accentColor: option.color,
        });
      }
    }
  }, [targetIds]);

  const TierIcon = TIER_ICONS[data.category?.toLowerCase() ?? ''] || Server;
  const techLabel = data.tech
    ? TECH_LABELS[data.tech.toLowerCase()] || data.tech
    : null;

  const commitLabel = () => {
    if (localLabel.trim()) applyToAll({ label: localLabel.trim() });
  };

  const handleDuplicate = () => {
    if (!node) return;
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
    applyToAll({ status: nextStatus });
  };

  const handleColorChange = () => {
    const colors = [
      '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#6b7280',
      '#f43f5e', '#a855f7', '#84cc16', '#fb923c', '#0d9488',
    ];
    const currentIndex = colors.indexOf(data.accentColor || data.color || '#3b82f6');
    const nextColor = colors[(currentIndex + 1) % colors.length];
    applyToAll({ accentColor: nextColor });
  };



  const handleShapeChange = (newShape: ShapeType) => {
    useDiagramStore.getState().pushHistory();
    for (const id of targetIds) {
      const existing = useDiagramStore.getState().nodes.find((n) => n.id === id);
      if (!existing) continue;
      const isSystemNode = existing.type === 'systemNode' || existing.type === 'architectureNode' || existing.type === 'baseNode';
      if (isSystemNode) {
        const newNode = {
          ...existing,
          type: 'shapeNode' as const,
          data: {
            ...existing.data,
            shape: newShape,
            label: existing.data?.label || 'Node',
            color: existing.data?.accentColor || existing.data?.color || '#3b82f6',
            accentColor: existing.data?.accentColor || existing.data?.color || '#3b82f6',
          },
        };
        useDiagramStore.getState().importDiagram(
          useDiagramStore.getState().nodes.map((n) => n.id === id ? newNode : n),
          useDiagramStore.getState().edges
        );
      } else {
        useDiagramStore.getState().updateNodeData(id, { shape: newShape });
      }
    }
  };

  const currentShape = (node?.type === 'shapeNode' ? (node.data as { shape?: ShapeType }).shape : null) || 'rounded-rectangle';
  const isShapeNode = node?.type === 'shapeNode';

  const accent = data.accentColor || data.color || '#3b82f6';
  const currentType = data.componentType || 'service';

  const statusColor = data.status === 'warning' ? '#F59E0B' : data.status === 'error' ? '#EF4444' : data.status === 'unknown' ? '#6B7280' : '#10B981';

  if (selectedEdgeId && !node && !isMulti) {
    return <EdgePropertiesPanel />;
  }

  if (!node && !isMulti) return null;

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
        <span className="text-sm font-medium">
          {isMulti ? `${targetIds.length} Nodes Selected` : 'Node Info'}
        </span>
        <div className="flex items-center gap-1">
          {!isMulti && node && (
            <button onClick={handleDuplicate} title="Duplicate" className="floating-icon-btn !w-8 !h-8">
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleStatusChange} title="Toggle Status" className="floating-icon-btn !w-8 !h-8">
            <Circle className="w-3 h-3" fill={statusColor} />
          </button>
          <button onClick={handleColorChange} title="Change Color" className="floating-icon-btn !w-8 !h-8">
            <Circle className="w-3 h-3" fill={accent} />
          </button>
          <button
            onClick={() => { setSelectedNodeId(null); setSelectedNodeIds([]); }}
            className="floating-icon-btn !w-8 !h-8"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        {/* Label (single node only) */}
        {!isMulti && (
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
        )}

        {/* Component Type */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            Component Type
          </label>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {COMPONENT_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = currentType === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => applyTypeChange(option.value)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-[10px] transition-all ${
                    isSelected
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary hover:bg-secondary/80 text-muted-foreground border border-transparent'
                  }`}
                  title={option.label}
                  style={isSelected ? { borderColor: option.color, color: option.color } : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
          {isMulti && (
            <p className="text-[9px] text-muted-foreground/60 mt-1.5">
              Applies to all {targetIds.length} selected nodes
            </p>
          )}
        </div>

        {/* Shape */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
            <Square className="w-3 h-3" />
            Shape
            {isShapeNode && (
              <span className="text-[9px] text-muted-foreground/60 normal-case">(Shape Node)</span>
            )}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {SHAPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = currentShape === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleShapeChange(option.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] transition-all ${
                    isSelected
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary hover:bg-secondary/80 text-muted-foreground border border-transparent'
                  }`}
                  title={option.label}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate w-full text-center">{option.label}</span>
                </button>
              );
            })}
          </div>
          {!isShapeNode && !isMulti && (
            <p className="text-[9px] text-muted-foreground/60 mt-1.5">
              Changing shape converts to Shape Node
            </p>
          )}
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
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
            Technology
          </label>
          <input
            type="text"
            value={data.tech || data.technology || ''}
            placeholder="e.g. PostgreSQL, Redis"
            onChange={(e) => applyToAll({ tech: e.target.value, technology: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-primary/30"
          />
          {isMulti && (
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Applies to all {targetIds.length} selected nodes
            </p>
          )}
        </div>

        {/* Subtitle / Description */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
            Description
          </label>
          <input
            type="text"
            value={data.sublabel || data.description || ''}
            placeholder="Optional description"
            onChange={(e) => applyToAll({ sublabel: e.target.value, description: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-primary/30"
          />
          {isMulti && (
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Applies to all {targetIds.length} selected nodes
            </p>
          )}
        </div>

        {/* Dimensions - only for groups */}
        {(data as { isGroup?: boolean }).isGroup && node && (
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
                  value={node.width ?? (node.style?.width as number) ?? 180}
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
                  value={node.height ?? (node.style?.height as number) ?? 100}
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

        {/* Group color - only for groups */}
        {(data as { isGroup?: boolean }).isGroup && node && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2 flex items-center gap-1.5">
              <Circle className="w-3 h-3" />
              Group Color
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyToAll({ groupColor: c, accentColor: c })}
                  className="w-6 h-6 rounded-full border border-border/50 transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        {/* Node ID (for reference, single node only) */}
        {!isMulti && node && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              ID
            </label>
            <div className="px-3 py-2 text-xs bg-secondary rounded-xl text-muted-foreground font-mono truncate" title={node.id}>
              {node.id}
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="pt-4 border-t border-border/50">
          <button
            onClick={() => {
              useDiagramStore.getState().pushHistory();
              for (const id of targetIds) {
                useDiagramStore.getState().removeNode(id);
              }
              setSelectedNodeId(null);
              setSelectedNodeIds([]);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Delete {isMulti ? `${targetIds.length} Nodes` : 'Node'}
          </button>
        </div>
      </div>
    </div>
  );
}
