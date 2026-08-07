'use client';

import { memo, useCallback, useRef } from 'react';
import { NodeProps } from 'reactflow';
import { useDiagramStore, NodeData } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme';
import { Activity, Palette, Pencil, Copy, Trash2 } from 'lucide-react';
import { FloatingHandles } from './nodes/FloatingHandles';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { NodeIcon } from '@/components/NodeIcon';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';
import { resolveAutoCloudIcon } from '@/lib/cloudIcons/autoResolution';
import { ProviderServiceIcon } from '@/components/icons/ProviderServiceIcon';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
import {
  getConcernColor,
  SIZE_M,
  STATUS_COLORS,
  CONCERN_COLORS,
  ICON_SIZE,
} from '@/lib/theme/stylingConstants';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import './nodes/nodeStyles.css';

const NODE_WIDTH = DIAGRAM_CONSTANTS.node.width;
const NODE_HEIGHT = DIAGRAM_CONSTANTS.node.minHeight;

function hexToRgba(hex: string, alpha: number): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDarkCategoryStyle(layer?: string): { border: string; glow: string } {
  const color = getConcernColor(layer);
  return { border: color, glow: hexToRgba(color, 0.12) };
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

const ACCENT_CYCLE = Object.values(CONCERN_COLORS).map((c) => c.color);

function SystemNodeComponent({ id, data, selected }: NodeProps<NodeData>) {
  const setSelectedNodeId = useDiagramStore((s) => s.setSelectedNodeId);
  const iconMode = useDiagramStore((s) => s.iconMode);
  const diagramChromeMode = useDiagramStore((s) => s.diagramChromeMode);
  const { isDark } = useCanvasTheme();
  const nodeCardRef = useRef<HTMLDivElement>(null);
  const showEditChrome = diagramChromeMode !== 'present';

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
    autoStartLabelEdit?: boolean;
  };

  const isDatabase = nodeData.shape === 'cylinder' || nodeData.serviceType === 'database';
  const isQueue = nodeData.serviceType === 'queue';

  const nodeKind = (() => {
    const st = nodeData.serviceType;
    if (isDatabase) return 'database';
    if (isQueue) return 'queue';
    if (st === 'client') return 'client';
    if (st === 'load-balancer') return 'load-balancer';
    if (st === 'ai') return 'ai';
    if (st === 'server') return 'server';
    if (st === 'docker') return 'docker';
    if (st === 'api') return 'api';
    if (st === 'service') return 'service';
    return null;
  })();

  const tierColor = getConcernColor(nodeData.layer || nodeData.serviceType);
  const accentColor = nodeData.accentColor || nodeData.color || tierColor;
  const resolvedIcon = resolveNodeIcon({
    label: data.label,
    typeId: nodeData.typeId,
    componentType: nodeData.componentType,
    serviceType: nodeData.serviceType,
    technology: nodeData.technology,
    category: nodeData.category,
    icon: nodeData.icon,
    color: accentColor,
  });
  const providerIcon = resolveAutoCloudIcon({
    label: data.label,
    typeId: nodeData.typeId,
    componentId: (nodeData as { componentId?: string }).componentId,
    technology: nodeData.technology,
    serviceType: nodeData.serviceType,
    icon: nodeData.icon,
  });
  const showIcon = resolveNodeIconVisibility(iconMode, nodeData.showIcon, resolvedIcon.source === 'manual');

  const statusColor = STATUS_COLORS[nodeData.status || 'healthy'];
  const showStatus = showEditChrome && nodeData.status && nodeData.status !== 'healthy';

  const labelEdit = useInlineLabelEdit({
    nodeId: id,
    currentLabel: data.label || '',
    containerRef: nodeCardRef,
    autoStart: Boolean(nodeData.autoStartLabelEdit),
  });

  const catStyle = getDarkCategoryStyle(nodeData.layer || nodeData.serviceType);
  const accentSoft = hexToRgba(accentColor, isDark ? 0.08 : 0.04);
  const accentBg = hexToRgba(accentColor, isDark ? 0.14 : 0.08);

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
    const current = nodeData.accentColor || nodeData.color || ACCENT_CYCLE[0];
    const currentIndex = ACCENT_CYCLE.indexOf(current);
    const nextColor = ACCENT_CYCLE[(currentIndex + 1) % ACCENT_CYCLE.length];
    useDiagramStore.getState().updateNodeData(id, { accentColor: nextColor });
  }, [id, nodeData.accentColor, nodeData.color]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().setSidebarOpen(true);
  }, []);

  const fitted = calculateNodeDimensions(data.label || '', nodeData.subtitle, {
    shape: 'rounded-rectangle',
    minWidth: SIZE_M,
  });
  const cardWidth = Math.max(nodeData.nodeWidth || NODE_WIDTH, fitted.width);
  const cardHeight = Math.max(nodeData.nodeHeight || NODE_HEIGHT, fitted.height);
  const cloudIconSize = Math.max(
    ICON_SIZE.cloudMin,
    Math.round(Math.min(cardWidth * 0.2, cardHeight - 28)),
  );

  return (
      <div
        className={`node-wrapper${selected ? ' selected' : ''}${nodeKind ? ` node-${nodeKind}` : ''}`}
        style={{
          ['--node-accent' as string]: accentColor,
          ['--node-accent-soft' as string]: accentSoft,
          ['--node-accent-bg' as string]: accentBg,
          ['--node-accent-track' as string]: hexToRgba(accentColor, 0.35),
          ['--node-glow' as string]: catStyle.glow,
          ['--node-glow-border' as string]: catStyle.border,
          ['--node-status-color' as string]: statusColor,
        }}
      >
        <div
          ref={nodeCardRef}
          className={`group node-card${nodeKind === 'database' ? ' node-card-db' : ''}`}
          style={{
            width: cardWidth,
            minWidth: Math.max(NODE_WIDTH, SIZE_M),
            minHeight: cardHeight,
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

        <div className="node-header">
          {showIcon && (
          <div
            className="node-icon-box"
            style={
              providerIcon
                ? { width: cloudIconSize, height: cloudIconSize }
                : undefined
            }
            aria-hidden="true"
          >
            {providerIcon ? (
              <ProviderServiceIcon
                provider={providerIcon.kind}
                serviceKey={providerIcon.serviceKey}
                size={Math.round(cloudIconSize * 0.72)}
                color={providerIcon.color}
              />
            ) : (
              <NodeIcon
                technology={resolvedIcon.technology}
                fallbackIcon={resolvedIcon.icon}
                fallbackColor={resolvedIcon.color}
                size={ICON_SIZE.node}
              />
            )}
          </div>
          )}
          {labelEdit.isEditing ? (
            <input
              {...labelEdit.inputProps}
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--node-title-color)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '-0.015em',
                width: '100%',
                minWidth: 0,
                flex: 1,
                boxSizing: 'border-box',
                borderRadius: 3,
                boxShadow: '0 0 0 2px var(--node-accent)',
                cursor: 'text',
              }}
            />
          ) : (
            <p
              className="node-title whitespace-pre-line"
              title={data.label || 'Double-click to rename'}
              onDoubleClick={labelEdit.startEdit}
              style={{
                cursor: 'text',
                minHeight: '1.25em',
                opacity: data.label ? 1 : 0.45,
              }}
            >
              {data.label || 'Service'}
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
