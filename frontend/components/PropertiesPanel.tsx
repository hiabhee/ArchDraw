'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { X, Type, Search, Copy, Trash2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { useDiagramStore, type NodeData } from '@/store/diagramStore';
import type { ShapeType } from '@/components/ShapeNode';
import { CustomNodeIcon, type CustomNodeIconName } from '@/components/icons/CustomNodeIcon';
import { ARCH_ICON_CATALOG, ARCH_ICON_CATEGORY_LABELS, type ArchIconCategory } from '@/lib/archIconCatalog';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';

const GROUP_COLOR_OPTIONS = [
  '#3b82f6', '#22c55e', '#ec4899', '#f97316', '#14b8a6',
  '#06b6d4', '#eab308', '#f43f5e', '#64748b', '#2563eb',
];

const SHAPES: { value: ShapeType; label: string; icon: string }[] = [
  { value: 'rounded-rectangle', label: 'Rect', icon: '▭' },
  { value: 'diamond', label: 'Diamond', icon: '◇' },
  { value: 'circle', label: 'Circle', icon: '○' },
  { value: 'cylinder', label: 'Cylinder', icon: '⬢' },
  { value: 'hexagon', label: 'Hex', icon: '⬣' },
  { value: 'cloud', label: 'Cloud', icon: '☁' },
  { value: 'monitor', label: 'Monitor', icon: '▣' },
  { value: 'queue', label: 'Queue', icon: '≡' },
  { value: 'parallelogram', label: 'Para', icon: '▱' },
  { value: 'mobile', label: 'Phone', icon: '▯' },
  { value: 'document', label: 'Doc', icon: '⧉' },
];

function EdgePropertiesPanel() {
  const { selectedEdgeId, edges, updateEdgeLabel, updateEdgeData, setSelectedEdgeId } = useDiagramStore();
  const edge = edges.find((e) => e.id === selectedEdgeId);
  const [localLabel, setLocalLabel] = useState(edge?.data?.label ?? '');
  const [prevEdge, setPrevEdge] = useState(edge);

  if (edge !== prevEdge) {
    setPrevEdge(edge);
    setLocalLabel(edge?.data?.label ?? '');
  }

  if (!edge) return null;

  const currentEdgeType = (edge.data?.edgeType || edge.data?.connectionType || 'sync') as string;

  const handleEdgeTypeChange = (type: 'sync' | 'async') => {
    if (!selectedEdgeId) return;
    updateEdgeData(selectedEdgeId, { 
      edgeType: type,
      connectionType: type,
      async: type === 'async',
    });
  };

  return (
    <div className="floating-panel z-50 overflow-y-auto p-5 fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] sm:inset-x-auto sm:right-4 sm:top-[80px] sm:bottom-auto sm:w-[320px] sm:max-h-[calc(100dvh-200px)] max-h-[45dvh] sm:max-h-[calc(100dvh-200px)] rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl">
      {/* Mobile drag handle */}
      <div className="sm:hidden flex justify-center pb-3 -mt-1">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-semibold tracking-tight">Edge</h3>
        <button onClick={() => setSelectedEdgeId(null)} className="min-w-[44px] min-h-[44px] sm:w-7 sm:h-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {(['sync','async'] as const).map(t => (
            <button
              key={t}
              onClick={() => handleEdgeTypeChange(t)}
              className={`py-2.5 rounded-xl text-xs font-medium capitalize transition-all border ${
                currentEdgeType === t
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-secondary hover:bg-secondary/70 border-transparent text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-2 block">Label</label>
          <input
            type="text"
            value={localLabel}
            placeholder="e.g. GET /api"
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => { if (selectedEdgeId) updateEdgeLabel(selectedEdgeId, localLabel); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { if (selectedEdgeId) updateEdgeLabel(selectedEdgeId, localLabel); (e.target as HTMLInputElement).blur(); } e.stopPropagation(); }}
            className="w-full px-3 py-2.5 text-sm bg-secondary/70 border border-border/50 rounded-xl outline-none focus:border-primary/50 focus:bg-card transition-colors"
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [iconCategory, setIconCategory] = useState<ArchIconCategory | 'all'>('all');

  if (node !== prevNode) {
    setPrevNode(node);
    setLocalLabel(node?.data?.label ?? '');
  }

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

  const commitLabel = () => {
    if (localLabel.trim()) applyToAll({ label: localLabel.trim() });
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

  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    return ARCH_ICON_CATALOG.filter((entry) => {
      if (iconCategory !== 'all' && entry.category !== iconCategory) return false;
      if (!q) return true;
      return entry.label.toLowerCase().includes(q) || entry.id.includes(q);
    }).slice(0, 48);
  }, [iconSearch, iconCategory]);

  if (selectedEdgeId && !node && !isMulti) {
    return <EdgePropertiesPanel />;
  }

  if (!node && !isMulti) return null;

  return (
    <div className="floating-panel z-50 overflow-y-auto p-0 fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] sm:inset-x-auto sm:right-4 sm:top-[80px] sm:bottom-auto sm:w-[340px] sm:max-h-[calc(100dvh-160px)] max-h-[50dvh] sm:max-h-[calc(100dvh-160px)] rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col">
      {/* Mobile drag handle */}
      <div className="sm:hidden flex justify-center py-2 shrink-0">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">
            {isMulti ? `${targetIds.length} selected` : data.label || 'Node'}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {isMulti ? 'Bulk edit' : data.category || data.serviceType || 'Shape node'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isMulti && node && (
            <button onClick={() => useDiagramStore.getState().duplicateNode(node.id)} title="Duplicate" className="min-w-[44px] min-h-[44px] sm:w-7 sm:h-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
              <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
          <button onClick={() => { setSelectedNodeId(null); setSelectedNodeIds([]); }} className="min-w-[44px] min-h-[44px] sm:w-7 sm:h-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
        {/* Label */}
        {!isMulti && (
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Label
            </label>
            <input
              ref={labelRef}
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') labelRef.current?.blur(); e.stopPropagation(); }}
              placeholder="Service name"
              className="w-full px-3 py-2.5 text-sm bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50 focus:bg-card transition-colors"
            />
          </div>
        )}

        {/* Appearance: Shape + Color */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-2 block">Shape</label>
            <div className="grid grid-cols-4 gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleShapeChange(s.value as ShapeType)}
                  title={s.label}
                  className={`h-[56px] rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    currentShape === s.value
                      ? 'bg-foreground text-background border-foreground shadow-sm'
                      : 'bg-secondary/60 hover:bg-secondary border-transparent hover:border-border text-muted-foreground'
                  }`}
                >
                  <span className="text-[18px] leading-none">{s.icon}</span>
                  <span className="text-[9px] font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Color
            </label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyToAll({ accentColor: c, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${accent === c ? 'border-foreground scale-110 shadow-sm' : 'border-white/20 hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Icon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3 h-3" /> Icon
            </label>
            <button
              onClick={() => applyToAll({ showIcon: !iconVisible })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${iconVisible ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'}`}
            >
              {iconVisible ? 'On' : 'Off'}
            </button>
          </div>

          <div className={`flex items-center gap-3 p-2.5 rounded-xl border mb-3 ${iconVisible ? 'bg-secondary/40 border-border/50' : 'bg-secondary/20 border-transparent opacity-60'}`}>
            <div className="w-9 h-9 rounded-lg bg-card border border-border/50 flex items-center justify-center shrink-0">
              <CustomNodeIcon name={currentIcon as CustomNodeIconName} color={accent} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{currentIcon.replace('arch-', '').replace(/-/g, ' ')}</p>
              <p className="text-[11px] text-muted-foreground truncate">{data.serviceType || 'Icon'}</p>
            </div>
          </div>

          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={iconSearch}
              placeholder="Search icons"
              onChange={(e) => setIconSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50 focus:bg-card transition-colors"
            />
          </div>

          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setIconCategory('all')} className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors ${iconCategory === 'all' ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>All</button>
            {(Object.keys(ARCH_ICON_CATEGORY_LABELS) as ArchIconCategory[]).slice(0,5).map((cat) => (
              <button
                key={cat}
                onClick={() => setIconCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors ${iconCategory === cat ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {ARCH_ICON_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1.5 max-h-[140px] overflow-y-auto p-1 -m-1">
            {filteredIcons.map((entry) => {
              const isSelected = currentIcon === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => applyToAll({ icon: entry.id })}
                  title={entry.label}
                  className={`aspect-square rounded-xl flex items-center justify-center border transition-all ${isSelected ? 'bg-foreground text-background border-foreground shadow-sm scale-[0.98]' : 'bg-card border-border/50 hover:border-border hover:bg-secondary/50'}`}
                >
                  <CustomNodeIcon name={entry.id as CustomNodeIconName} color={isSelected ? '#fff' : '#6B7280'} size={16} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced */}
        <div className="border-t border-border/40 pt-4">
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span>Advanced</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAdvanced && (
            <div className="space-y-4 mt-3 animate-in fade-in duration-150">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Technology</label>
                <input
                  type="text"
                  value={data.tech || data.technology || ''}
                  placeholder="PostgreSQL, Redis..."
                  onChange={(e) => applyToAll({ tech: e.target.value, technology: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50 focus:bg-card transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Description</label>
                <input
                  type="text"
                  value={data.sublabel || data.description || ''}
                  placeholder="Optional"
                  onChange={(e) => applyToAll({ sublabel: e.target.value, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50 focus:bg-card transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Group size */}
        {(data as { isGroup?: boolean }).isGroup && node && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Width</label>
              <input
                type="number"
                value={node.width ?? (node.style?.width as number) ?? 180}
                onChange={(e) => updateNodeSize(node.id, { width: parseInt(e.target.value) || 180 })}
                className="w-full px-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Height</label>
              <input
                type="number"
                value={node.height ?? (node.style?.height as number) ?? 100}
                onChange={(e) => updateNodeSize(node.id, { height: parseInt(e.target.value) || 100 })}
                className="w-full px-3 py-2 text-xs bg-secondary/60 border border-border/50 rounded-xl outline-none focus:border-primary/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/40 bg-secondary/20 shrink-0">
        <button
          onClick={() => {
            useDiagramStore.getState().pushHistory();
            for (const id of targetIds) useDiagramStore.getState().removeNode(id);
            setSelectedNodeId(null); setSelectedNodeIds([]);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete {isMulti ? `${targetIds.length} nodes` : 'node'}
        </button>
      </div>
    </div>
  );
}
