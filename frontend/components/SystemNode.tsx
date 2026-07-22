'use client';

import { memo, useCallback, useRef } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useDiagramStore, NodeData } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { Activity, Palette, Pencil, Copy, Trash2 } from 'lucide-react';
import { FloatingHandles } from './nodes/FloatingHandles';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { NodeIcon } from '@/components/NodeIcon';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
import './nodes/nodeStyles.css';

const NODE_WIDTH = DIAGRAM_CONSTANTS.node.width;
const NODE_HEIGHT = DIAGRAM_CONSTANTS.node.minHeight;

function calcNodeWidth(label?: string, subtitle?: string): number {
  const labelLength = typeof label === 'string' ? label.length : 0;
  const subtitleLength = typeof subtitle === 'string' ? subtitle.length : 0;
  const longest = Math.max(labelLength, subtitleLength);
  // ~8px per character for typical font sizes, min 200
  return Math.max(200, Math.min(320, longest * 9));
}

const STATUS_COLORS = {
  healthy: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  unknown: '#6B7280',
};

function getTierColorNormalized(layer?: string): string {
  const tier = (layer || 'compute').toLowerCase();
  const colorMap: Record<string, string> = {
    client:   '#64748b',
    edge:     '#6366f1',
    compute:  '#0d9488',
    async:    '#d97706',
    data:     '#3b82f6',
    observe:  '#8b5cf6',
    external: '#ec4899',
  };
  return colorMap[tier] || colorMap.compute;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDarkCategoryStyle(layer?: string): { border: string; glow: string } {
  const tier = (layer || 'compute').toLowerCase();
  const map: Record<string, { border: string; glow: string }> = {
    client:      { border: '#60A5FA', glow: 'rgba(96,165,250,0.15)' },
    edge:        { border: '#60A5FA', glow: 'rgba(96,165,250,0.15)' },
    compute:     { border: '#34D399', glow: 'rgba(52,211,153,0.15)' },
    async:       { border: '#FBBF24', glow: 'rgba(251,191,36,0.15)' },
    data:        { border: '#F87171', glow: 'rgba(248,113,113,0.15)' },
    observe:     { border: '#A78BFA', glow: 'rgba(167,139,250,0.15)' },
    external:    { border: '#22D3EE', glow: 'rgba(34,211,238,0.15)' },
  };
  return map[tier] || map.compute;
}

function ToolbarButton({
  onClick,
  children,
  title,
  danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`node-toolbar-btn${danger ? ' node-toolbar-btn--danger' : ''}`}
    >
      {children}
    </button>
  );
}

function SystemNodeComponent({ id, data, selected }: NodeProps<NodeData>) {
  const setSelectedNodeId = useDiagramStore((s) => s.setSelectedNodeId);
  const updateNodeInternals = useUpdateNodeInternals();
  const { isDark } = useCanvasTheme();
  const nodeCardRef = useRef<HTMLDivElement>(null);

  const nodeData = data as NodeData & {
    layer?: string;
    subtitle?: string;
    status?: 'healthy' | 'warning' | 'error' | 'unknown';
    color?: string;
    shape?: string;
    nodeWidth?: number;
    nodeHeight?: number;
    accentColor?: string;
    serviceType?: string;
  };

  const isDatabase = nodeData.shape === 'cylinder' || nodeData.serviceType === 'database';
  const isQueue = nodeData.serviceType === 'queue';

  const tierColor = getTierColorNormalized(nodeData.layer);
  const accentColor = nodeData.accentColor || nodeData.color || tierColor || '#0D9488';

  const statusColor = STATUS_COLORS[nodeData.status || 'healthy'];
  const showStatus = nodeData.status && nodeData.status !== 'healthy';

  const labelEdit = useInlineLabelEdit({
    nodeId: id,
    currentLabel: data.label || '',
    containerRef: nodeCardRef,
  });

  const backplateLayers = selected
    ? [
        { offset: 10, color: isDark ? '#0d0f1b' : '#ffffff' },
        { offset: 5, color: isDark ? '#151828' : '#e8e8e8' },
      ]
    : [
        { offset: 10, color: isDark ? '#0d0f1b' : '#ffffff' },
        { offset: 5, color: isDark ? '#151828' : '#f5f5f5' },
      ];

  const catStyle = getDarkCategoryStyle(nodeData.layer);

  const handleClick = useCallback(() => {
    setSelectedNodeId(id);
  }, [id, setSelectedNodeId]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nodes = useDiagramStore.getState().nodes;
    const node = nodes.find(n => n.id === id);
    if (node) {
      const newId = `${id}-copy-${Date.now()}`;
      useDiagramStore.getState().addNode({
        ...node,
        id: newId,
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        data: { ...node.data, label: `${node.data.label} (copy)` },
      });
      useDiagramStore.getState().setSelectedNodeIds([newId]);
    }
  }, [id]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().removeNode(id);
  }, [id]);

  const handleStatusChange = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses: Array<'healthy' | 'warning' | 'error' | 'unknown'> = ['healthy', 'warning', 'error', 'unknown'];
    const currentIndex = statuses.indexOf(nodeData.status || 'healthy');
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    useDiagramStore.getState().updateNodeData(id, { status: nextStatus });
  }, [id, nodeData.status]);

  const handleColorChange = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const colors = [
      '#64748b', '#6366f1', '#0d9488', '#d97706', '#3b82f6', '#8b5cf6', '#ec4899',
      '#0284c7', '#059669', '#c026d3', '#65a30d', '#0891b2',
    ];
    const currentIndex = colors.indexOf(nodeData.accentColor || nodeData.color || '#6B7280');
    const nextColor = colors[(currentIndex + 1) % colors.length];
    useDiagramStore.getState().updateNodeData(id, { accentColor: nextColor });
  }, [id, nodeData.accentColor, nodeData.color]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().setSidebarOpen(true);
  }, []);

  return (
      <div
        className={`node-wrapper${selected ? ' selected' : ''}${isDatabase ? ' node-cylinder' : ''}${isQueue ? ' node-queue' : ''}`}
        style={{
          ['--node-accent' as string]: accentColor,
          ['--node-accent-soft' as string]: hexToRgba(accentColor, 0.04),
          ['--node-accent-bg' as string]: `${accentColor}12`,
          ['--node-glow' as string]: catStyle.glow,
          ['--node-glow-border' as string]: catStyle.border,
          ['--node-status-color' as string]: statusColor,
        }}
      >
        {backplateLayers.map((layer, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: isDatabase ? 12 : 16,
              transform: `translate(${layer.offset}px, ${layer.offset}px)`,
              background: layer.color,
              zIndex: i + 1,
              pointerEvents: 'none',
              transition: 'all 150ms ease',
            }}
          />
        ))}
        <div
          ref={nodeCardRef}
          className={`group node-card${isDatabase ? ' node-card-db' : ''}`}
          style={{
            width: nodeData.nodeWidth || Math.max(NODE_WIDTH, calcNodeWidth(data.label, nodeData.subtitle)),
            minWidth: nodeData.nodeWidth || NODE_WIDTH,
            minHeight: nodeData.nodeHeight || NODE_HEIGHT,
          }}
        onClick={handleClick}
      >
        {selected && (
          <div className="node-toolbar" onClick={(e) => e.stopPropagation()}>
            <ToolbarButton onClick={handleEdit} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleDuplicate} title="Duplicate">
              <Copy className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleDelete} title="Delete" danger>
              <Trash2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <div className="node-toolbar-divider" />
            <ToolbarButton onClick={handleStatusChange} title="Toggle Status">
              <Activity className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleColorChange} title="Change Color">
              <Palette className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>
        )}
        <div className="node-shine" />
        <div className="node-header">
          {labelEdit.isEditing ? (
            <input
              {...labelEdit.inputProps}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--node-title-color)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                margin: 0,
                lineHeight: 1.3,
                width: '100%',
                minWidth: 0,
                flex: 1,
                boxSizing: 'border-box',
                borderRadius: 3,
                boxShadow: '0 0 0 2px var(--accent, #0d9488)',
                cursor: 'text',
              }}
            />
          ) : (
            <p
              className="node-title"
              title={data.label}
              onDoubleClick={labelEdit.startEdit}
              style={{ cursor: 'text' }}
            >
              {data.label}
            </p>
          )}
        </div>
        <div className="node-footer">
          {nodeData.subtitle && (
            <p className="node-subtitle" title={nodeData.subtitle}>
              {nodeData.subtitle}
            </p>
          )}
          {showStatus && (
            <div className="node-status-dot" />
          )}
        </div>
        <FloatingHandles nodeId={id} />
      </div>
    </div>
  );
}

export const SystemNode = memo(SystemNodeComponent);
export default SystemNode;
