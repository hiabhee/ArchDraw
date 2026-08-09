'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { X, Type, Database, Server, Zap, Globe, Activity, Shield, Maximize2, Copy, Circle, Square, Diamond, Cylinder as CylinderIcon, Disc, SlidersHorizontal, Search, Hexagon, Cloud, Smartphone, User, SquareDashed, Monitor } from 'lucide-react';
import { useDiagramStore, type NodeData } from '@/store/diagramStore';
import type { ShapeType } from '@/components/ShapeNode';
import { CustomNodeIcon, type CustomNodeIconName } from '@/components/icons/CustomNodeIcon';
import { ARCH_ICON_CATALOG, ARCH_ICON_CATEGORY_LABELS, type ArchIconCategory } from '@/lib/archIconCatalog';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';

const GROUP_COLOR_OPTIONS = [
  '#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6',
  '#3b82f6', '#06b6d4', '#eab308', '#f43f5e', '#64748b',
];

const SHAPE_GROUPS: { label: string; options: { value: ShapeType; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'Basic',
    options: [
      { value: 'rectangle', label: 'Rectangle', icon: Square },
      { value: 'rounded-rectangle', label: 'Rounded', icon: Square },
      { value: 'diamond', label: 'Diamond', icon: Diamond },
      { value: 'cylinder', label: 'Cylinder', icon: CylinderIcon },
      { value: 'circle', label: 'Circle', icon: Disc },
      { value: 'parallelogram', label: 'Parallel', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Semantic',
    options: [
      { value: 'hexagon', label: 'Hexagon', icon: Hexagon },
      { value: 'cloud', label: 'Cloud', icon: Cloud },
      { value: 'shield', label: 'Shield', icon: Shield },
      { value: 'dashed-rectangle', label: 'Dashed', icon: SquareDashed },
    ],
  },
  {
    label: 'Clients',
    options: [
      { value: 'monitor', label: 'Monitor', icon: Monitor },
      { value: 'mobile', label: 'Mobile', icon: Smartphone },
      { value: 'actor', label: 'Actor', icon: User },
    ],
  },
];

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
    <div className="floating-panel z-50 overflow-y-auto p-4 fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] top-[72px] sm:inset-x-auto sm:right-4 sm:top-[80px] sm:bottom-[180px] sm:w-80 max-h-[calc(100dvh-200px)]">
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
    selectedEdgeId, iconMode,
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
  const [iconSearch, setIconSearch] = useState('');
  const [iconCategory, setIconCategory] = useState<ArchIconCategory | 'all'>('all');

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
  const resolvedIcon = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology || data.tech,
    icon: data.icon,
    color: accent,
  });
  const currentIcon = data.icon?.startsWith('arch-') || data.icon?.startsWith('aws-')
    ? data.icon
    : resolvedIcon.icon;
  const iconVisible = resolveNodeIconVisibility(iconMode, data.showIcon);
  const iconQuery = iconSearch.trim().toLowerCase();
  const filteredIcons = ARCH_ICON_CATALOG.filter((entry) => {
    if (iconCategory !== 'all' && entry.category !== iconCategory) return false;
    if (!iconQuery) return true;
    return entry.label.toLowerCase().includes(iconQuery) || entry.id.includes(iconQuery);
  });

  const statusColor = data.status === 'warning' ? '#F59E0B' : data.status === 'error' ? '#EF4444' : data.status === 'unknown' ? '#6B7280' : '#10B981';

  if (selectedEdgeId && !node && !isMulti) {
    return <EdgePropertiesPanel />;
  }

  if (!node && !isMulti) return null;

  return (
    <div
      className="floating-panel z-50 overflow-y-auto p-4 fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] top-[72px] sm:inset-x-auto sm:right-4 sm:top-[80px] sm:bottom-[180px] sm:w-80 max-h-[calc(100dvh-200px)]"
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

        {/* Icon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              Icon
            </label>
            <button
              type="button"
              onClick={() => applyToAll({ showIcon: !iconVisible })}
              className={`px-2 py-1 rounded-md text-[9px] font-medium transition-colors ${
                iconVisible ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {iconVisible ? 'Visible' : 'Hidden'}
            </button>
          </div>
          {data.showIcon !== undefined && (
            <p className="text-[9px] text-muted-foreground/60 mb-2">
              This node overrides the global icon setting.
            </p>
          )}
          {isShapeNode && iconVisible && (
            <div className="mb-2">
              <span className="text-[9px] text-muted-foreground/80 block mb-1.5">Label display</span>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { mode: 'auto' as const, label: 'Auto', value: undefined },
                  { mode: 'on' as const, label: 'Icon only', value: true },
                  { mode: 'off' as const, label: 'With label', value: false },
                ]).map(({ mode, label, value }) => {
                  const current = (data as { iconOnly?: boolean }).iconOnly;
                  const isSelected =
                    mode === 'auto' ? current === undefined
                      : mode === 'on' ? current === true
                        : current === false;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyToAll({ iconOnly: value })}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground border border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-1.5">
                Auto hides the label for recognized brand logos on cylinders and rounded nodes.
              </p>
            </div>
          )}
          <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 bg-secondary rounded-lg${iconVisible ? '' : ' opacity-50'}`}>
            <CustomNodeIcon name={currentIcon as CustomNodeIconName} color={accent} size={20} />
            <span className="text-[10px] text-muted-foreground truncate">{currentIcon.replace('arch-', '').replace(/-/g, ' ')}</span>
          </div>
          <input
            type="text"
            value={iconSearch}
            placeholder="Search icons..."
            onChange={(e) => setIconSearch(e.target.value)}
            className="w-full px-3 py-2 mb-2 text-xs bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setIconCategory('all')}
              className={`px-2 py-1 rounded-md text-[9px] transition-colors ${
                iconCategory === 'all' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
              }`}
            >
              All
            </button>
            {(Object.keys(ARCH_ICON_CATEGORY_LABELS) as ArchIconCategory[]).map((category) => (
              <button
                key={category}
                onClick={() => setIconCategory(category)}
                className={`px-2 py-1 rounded-md text-[9px] transition-colors ${
                  iconCategory === category ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {ARCH_ICON_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto pr-1">
            {filteredIcons.map((entry) => {
              const isSelected = currentIcon === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => applyToAll({ icon: entry.id })}
                  className={`flex items-center justify-center p-1.5 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-primary/15 border border-primary/30'
                      : 'bg-secondary hover:bg-secondary/80 border border-transparent'
                  }`}
                  title={entry.label}
                >
                  <CustomNodeIcon name={entry.id as CustomNodeIconName} color={isSelected ? accent : '#6B7280'} size={18} />
                </button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-[9px] text-muted-foreground/60 mt-1">No icons match your search.</p>
          )}
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
          <div className="space-y-3">
            {SHAPE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {group.options.map((option) => {
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
              </div>
            ))}
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
