'use client';

import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { findNodeById } from '@/store/diagram/derive';
import { useDiagramStore, NodeData } from '@/store/diagramStore';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { Activity, Palette, Pencil, Copy, Trash2 } from 'lucide-react';
import { FloatingHandles } from './FloatingHandles';
import { DIAGRAM_CONSTANTS } from '@/lib/diagram/constants/diagram';
import { NodeIcon } from '@/components/canvas/nodes/NodeIcon';
import { resolveNodeIcon } from '@/lib/icons/nodeIconResolver';
import { resolveNodeIconVisibility } from '@/lib/diagram/nodes/nodeIconVisibility';
import { resolveAutoCloudIcon } from '@/lib/icons/cloud/autoResolution';
import { ProviderServiceIcon } from '@/components/icons/ProviderServiceIcon';
import { TechnologyBrandIcon } from '@/components/icons/TechnologyBrandIcon';
import { getTechnologyBrandSlug } from '@/lib/icons/brandIcons';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { applyShapeSurface, getBrutalNodeFill, getStrokeRenderer, isStudioRenderStyle, renderSketchSurface, type RenderSurface } from '@/lib/theme/renderStyles';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import { resolveConcern, SIZE_M, STATUS_COLORS } from '@/lib/theme/stylingConstants';
import { calculateNodeDimensions } from '@/lib/diagram/nodes/nodeSizing';
import {
  STUDIO_ICON_GLYPH_PX,
  STUDIO_ICON_WELL_PX,
  studioContentNodeSize,
  studioCompactNodeSize,
} from '@/lib/diagram/nodes/shapeNodeDimensions';
import './nodeStyles.css';

const NODE_WIDTH = DIAGRAM_CONSTANTS.node.width;
const _NODE_HEIGHT = DIAGRAM_CONSTANTS.node.minHeight;
const SYSTEM_ICON_WELL_PX = 40;
const SYSTEM_ICON_GLYPH_PX = 24;

function hexToRgba(hex: string, alpha: number): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDarkCategoryStyle(color: string): { border: string; glow: string } {
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
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      title={title}
      className={`node-toolbar-btn nodrag nopan${danger ? ' node-toolbar-btn--danger' : ''}`}
    >
      {children}
    </button>
  );
}

function SystemNodeComponent({ id, data, selected }: NodeProps<NodeData>) {
  const setSelectedNodeId = useDiagramStore((s) => s.setSelectedNodeId);
  const { iconMode, readOnly } = useCanvasView();
  const diagramChromeMode = useDiagramStore((s) => s.diagramChromeMode);
  const { isDark } = useCanvasTheme();
  const aesthetics = useDiagramAesthetics();
  const nodeCardRef = useRef<HTMLDivElement>(null);
  const showEditChrome = !readOnly && diagramChromeMode !== 'present';

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

  const concernHint = nodeData.layer || nodeData.serviceType || nodeData.category;
  const concernSwatch = aesthetics.concerns[resolveConcern(concernHint)];
  const tierColor = concernSwatch.color;
  // `accentColor` is an explicit user choice. Generated `data.color` is not:
  // use the selected theme's semantic palette for generated cards.
  const accentColor = nodeData.accentColor || tierColor;
  const resolvedIcon = resolveNodeIcon({
    label: data.label,
    typeId: nodeData.typeId,
    componentType: nodeData.componentType,
    serviceType: nodeData.serviceType,
    technology: nodeData.technology,
    category: nodeData.category,
    icon: nodeData.icon,
    iconSource: nodeData.iconSource as import('@/lib/icons/nodeIconResolver').NodeIconSource | undefined,
    color: accentColor,
  });
  const providerIcon = isStudioRenderStyle(aesthetics.renderStyleId) || nodeData.iconSource === 'manual' ? null : resolveAutoCloudIcon({
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

  const sketch = aesthetics.renderStyleId === 'sketch';
  const brutal = aesthetics.renderStyleId === 'neubrutalism';
  const studio = isStudioRenderStyle(aesthetics.renderStyleId);
  const catStyle = getDarkCategoryStyle(accentColor);
  const accentSoft = hexToRgba(accentColor, isDark ? 0.08 : 0.04);
  const accentBg = nodeData.accentColor
    ? hexToRgba(accentColor, isDark ? 0.14 : 0.08)
    : concernSwatch.bg;
  const studioDarkSelected = studio && isDark && selected;
  const studioCardBg = studioDarkSelected ? '#f7f9fc' : aesthetics.colors.nodeFill;
  const studioIconColor = accentColor;
  const studioWellBg = nodeData.accentColor
    ? hexToRgba(accentColor, studioDarkSelected ? 0.14 : isDark ? 0.2 : 0.11)
    : concernSwatch.bg;
  const studioBorder = isDark
    ? selected ? hexToRgba(accentColor, 0.78) : 'rgba(148, 163, 184, 0.22)'
    : hexToRgba(accentColor, 0.36);
  const studioSelectedShadow = studioDarkSelected
    ? `0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 4px ${hexToRgba(accentColor, 0.16)}, 0 14px 32px rgba(0, 0, 0, 0.42)`
    : undefined;
  const brandTechnology = (!studio || studioDarkSelected) && resolvedIcon.source !== 'manual' && resolvedIcon.technology && getTechnologyBrandSlug(resolvedIcon.technology)
    ? resolvedIcon.technology
    : undefined;

  const handleClick = useCallback(() => {
    setSelectedNodeId(id);
  }, [id, setSelectedNodeId]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().duplicateNode(id);
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
    const accentCycle = Object.values(aesthetics.concerns).map((swatch) => swatch.color);
    const current = nodeData.accentColor || accentCycle[0];
    const currentIndex = accentCycle.indexOf(current);
    const nextColor = accentCycle[(currentIndex + 1) % accentCycle.length];
    useDiagramStore.getState().updateNodeData(id, { accentColor: nextColor });
  }, [id, nodeData.accentColor, aesthetics.concerns]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useDiagramStore.getState().setSidebarOpen(true);
  }, []);

  const studioSize = studioCompactNodeSize(showIcon);
  const fitted = calculateNodeDimensions(data.label || '', nodeData.subtitle, {
    shape: 'rounded-rectangle',
    minWidth: studio ? studioSize.width : SIZE_M,
    showIcon,
  });
  const cardWidth = studio ? Math.max(studioSize.width, fitted.width) : Math.max(nodeData.nodeWidth || NODE_WIDTH, fitted.width);
  // Studio cards keep the compact height until wrapped text needs more room.
  const cardHeight = studio
    ? studioContentNodeSize(data.label || '', nodeData.subtitle, showIcon, cardWidth).height
    : 100;
  const updateNodeInternals = useUpdateNodeInternals();
  const updateNodeSize = useDiagramStore((s) => s.updateNodeSize);
  const storedNodeWidth = useDiagramStore((s) => {
    if (readOnly) return undefined;
    const n = findNodeById(s.nodes, id);
    return (n?.data as { nodeWidth?: number } | undefined)?.nodeWidth;
  });
  const storedNodeHeight = useDiagramStore((s) => {
    if (readOnly) return undefined;
    const n = findNodeById(s.nodes, id);
    return (n?.data as { nodeHeight?: number } | undefined)?.nodeHeight;
  });
  const lastPushedSizeRef = useRef<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (readOnly) return;
    if (storedNodeWidth === cardWidth && storedNodeHeight === cardHeight) {
      lastPushedSizeRef.current = { w: cardWidth, h: cardHeight };
      return;
    }
    if (
      lastPushedSizeRef.current &&
      lastPushedSizeRef.current.w === cardWidth &&
      lastPushedSizeRef.current.h === cardHeight
    ) {
      return;
    }
    lastPushedSizeRef.current = { w: cardWidth, h: cardHeight };
    queueMicrotask(() => {
      const cur = useDiagramStore.getState().nodes.find((nd) => nd.id === id);
      const curW = (cur?.data as { nodeWidth?: number } | undefined)?.nodeWidth;
      const curH = (cur?.data as { nodeHeight?: number } | undefined)?.nodeHeight;
      if (curW === cardWidth && curH === cardHeight) return;
      updateNodeSize(id, { width: cardWidth, height: cardHeight });
    });
  }, [id, cardWidth, cardHeight, storedNodeWidth, storedNodeHeight, updateNodeSize, readOnly]);
  const pendingInternalsRef = useRef(false);
  useLayoutEffect(() => {
    if (pendingInternalsRef.current) return;
    pendingInternalsRef.current = true;
    queueMicrotask(() => {
      pendingInternalsRef.current = false;
      updateNodeInternals(id);
    });
  }, [id, cardWidth, cardHeight, updateNodeInternals]);
  // A compact Studio card can remain one row only when its icon supplies the
  // visual anchor. Without it, a wrapped subtitle needs its own text stack;
  // otherwise the footer is squeezed into the title row.
  const studioTextStack = studio && !showIcon && Boolean(nodeData.subtitle);
  // Keep brand/provider marks subordinate to the label on every card size.
  // Deriving icon dimensions from card width made wide cards show oversized logos.
  const iconBoxSize = studio ? STUDIO_ICON_WELL_PX : SYSTEM_ICON_WELL_PX;
  const iconGlyphSize = studio ? STUDIO_ICON_GLYPH_PX : SYSTEM_ICON_GLYPH_PX;

  // Sketch body: a rough SVG rounded-rect that bleeds ~2px past the card so
  // its wobbly border is fully visible once the crisp CSS border is removed.
  // Uses the same shapeGeometry → strokeRenderer path as ShapeNode.
  const sketchCardBody = useMemo(() => {
    if (!sketch) return '';
    const w = cardWidth + 4;
    const h = cardHeight + 4;
    const prims = getShapePrimitives('rounded-rectangle', w, h).map((p) =>
      p.rx ? { ...p, rx: Math.max(p.rx, Math.round(aesthetics.borderRadius)) } : p,
    );
    const surface: RenderSurface = {
      fill: aesthetics.cssVars['--arch-node-fill'] ?? aesthetics.colors.nodeFill,
      stroke: aesthetics.colors.nodeStroke,
      strokeWidth: aesthetics.strokeWidth,
    };
    return renderSketchSurface({
      primitives: prims,
      surface,
      seedId: id,
      isDark,
      shape: 'rounded-rectangle',
    });
  }, [sketch, cardWidth, cardHeight, aesthetics, id, isDark]);

  // Accent wash: subtle rough circle behind icon in sketch — very quiet.
  const sketchAccentWash = useMemo(() => {
    if (!sketch) return '';
    const renderer = getStrokeRenderer('rough');
    const s = iconBoxSize + 4;
    const surface: RenderSurface = {
      fill: hexToRgba(accentColor, isDark ? 0.12 : 0.07),
      stroke: 'none',
      strokeWidth: 0,
    };
    return applyShapeSurface(getShapePrimitives('circle', s, s), surface)
      .map((p) => renderer.renderPrimitive(p, renderer.seedFor(`${id}-wash`)))
      .join('\n');
  }, [sketch, iconBoxSize, accentColor, isDark, id]);

  return (
      <div
        className={`node-wrapper${selected ? ' selected' : ''}${nodeKind ? ` node-${nodeKind}` : ''}${studio && isDark ? ' node-wrapper--studio-minimal-dark' : ''}`}
        style={{
          ['--node-accent' as string]: studio ? studioIconColor : accentColor,
          ['--node-accent-soft' as string]: accentSoft,
          ['--node-accent-bg' as string]: studio ? studioWellBg : accentBg,
          ...(studio
            ? {
                ['--node-card-bg' as string]: studioCardBg,
                ['--node-title-color' as string]: studioDarkSelected ? '#111827' : aesthetics.colors.title,
                ['--node-subtitle-color' as string]: studioDarkSelected ? '#526174' : aesthetics.colors.subtitle,
                ['--arch-node-stroke' as string]: studioBorder,
                ...(studioDarkSelected
                  ? {
                      ['--node-shadow-selected' as string]: studioSelectedShadow,
                    }
                  : {}),
              }
            : {}),
          ...(brutal ? { ['--node-card-bg' as string]: getBrutalNodeFill(accentColor, isDark) } : {}),
          ['--node-accent-track' as string]: hexToRgba(accentColor, 0.35),
          ['--node-glow' as string]: catStyle.glow,
          ['--node-glow-border' as string]: catStyle.border,
          ['--node-status-color' as string]: statusColor,
        }}
      >
        {sketch && sketchCardBody && (
          <svg
            className="node-sketch-body"
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: cardWidth + 4,
              height: cardHeight + 4,
              zIndex: 3,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
            dangerouslySetInnerHTML={{ __html: sketchCardBody }}
          />
        )}
        <div
          ref={nodeCardRef}
          className={`group node-card${nodeKind === 'database' ? ' node-card-db' : ''}${studioTextStack ? ' node-card--studio-text-stack' : ''}`}
          style={{
            width: cardWidth,
            minWidth: studio ? studioSize.width : Math.max(NODE_WIDTH, SIZE_M),
            minHeight: cardHeight,
          }}
        onClick={handleClick}
      >
        {selected && !readOnly && (
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
            style={{ width: iconBoxSize, height: iconBoxSize }}
            aria-hidden="true"
          >
            {sketch && sketchAccentWash && (
              <svg
                className="node-sketch-accent"
                style={{
                  position: 'absolute',
                  top: -3,
                  left: -3,
                  width: iconBoxSize + 6,
                  height: iconBoxSize + 6,
                  zIndex: 0,
                  pointerEvents: 'none',
                  overflow: 'visible',
                }}
                dangerouslySetInnerHTML={{ __html: sketchAccentWash }}
              />
            )}
            {providerIcon ? (
              <ProviderServiceIcon
                provider={providerIcon.kind}
                serviceKey={providerIcon.serviceKey}
                size={iconGlyphSize}
                color={providerIcon.color}
              />
            ) : brandTechnology ? (
              <TechnologyBrandIcon technology={brandTechnology} size={iconGlyphSize} color={resolvedIcon.color} />
            ) : (
              <NodeIcon
                technology={resolvedIcon.technology}
                fallbackIcon={resolvedIcon.icon}
                fallbackColor={resolvedIcon.color}
                size={iconGlyphSize}
                renderStyle={aesthetics.renderStyleId}
              />
            )}
          </div>
          )}
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            {labelEdit.isEditing ? (
              <input
                {...labelEdit.inputProps}
                style={{
                  fontSize: sketch ? 18 : 16.2,
                  fontWeight: sketch ? 400 : brutal ? 700 : 600,
                  fontFamily: sketch
                    ? 'var(--font-patrick-hand, "Patrick Hand"), var(--arch-font-title, cursive)'
                    : brutal
                      ? 'var(--arch-font-title, sans-serif)'
                      : undefined,
                  color: 'var(--node-title-color)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: sketch ? '0.02em' : brutal ? '-0.02em' : '-0.015em',
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
            {nodeData.subtitle && (
              <p className="node-subtitle" title={nodeData.subtitle} style={{ marginTop: 2 }}>
                {nodeData.subtitle}
              </p>
            )}
          </div>
          {showStatus && (
            <div className="node-status-dot ml-2 shrink-0" />
          )}
        </div>
        <FloatingHandles nodeId={id} />
      </div>
    </div>
  );
}

export const SystemNode = memo(SystemNodeComponent);
export default SystemNode;
