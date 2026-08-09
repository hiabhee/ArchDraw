'use client';

import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';
import {
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
  ICON_SIZE,
  PROMINENT_ICON_SLOT_PX,
  PROMINENT_ICON_GLYPH_RATIO,
  prominentIconGlyphSize,
  type NodeStyleConfig,
} from '@/lib/theme/stylingConstants';
import { resolveCylinderAxis } from '@/lib/utils/cylinderAxis';
import { countPipeLabelLines } from '@/lib/utils/nodeSizing';
import { resolveShapeNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import {
  diamondClipPath,
  getDiamondLabelNudge,
  getShapeLabelMaxWidth,
} from '@/lib/utils/shapeTextLayout';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { useInlineLabelEdit } from '@/hooks/useInlineLabelEdit';
import { useDiagramStore } from '@/store/diagramStore';
import { NodeIcon } from '@/components/NodeIcon';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';
import { resolveAutoCloudIcon } from '@/lib/cloudIcons/autoResolution';
import { ProviderServiceIcon } from '@/components/icons/ProviderServiceIcon';
import { TechnologyBrandIcon } from '@/components/icons/TechnologyBrandIcon';
import { getTechnologyBrandSlug } from '@/lib/brandIcons';
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { type ShapeType } from '@/lib/shapeRegistry';
import './nodes/nodeStyles.css';

export type { ShapeType };

export type ShapeLabelLayout = 'default' | 'icon-brand' | 'pipe-text';export function resolveShapeLabelLayout(
  shape: ShapeType | undefined,
  data: ShapeNodeData,
  iconMode: NodeIconMode,
): ShapeLabelLayout {
  if (iconMode === 'off' || !shape) return 'default';
  if (shape === 'cylinder' && resolveCylinderAxis(data) === 'horizontal') return 'pipe-text';
  if (shape === 'cylinder' || shape === 'rounded-rectangle' || shape === 'circle') return 'icon-brand';
  // Semantic silhouettes prefer prominent icons too (LB logos, auth shields, web clients).
  if (shape !== 'diamond' && nodeHasProminentBrand(data)) return 'icon-brand';
  return 'default';
}

function nodeHasProminentBrand(data: ShapeNodeData): boolean {
  const resolved = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology,
    category: data.category,
    icon: data.icon,
    color: data.color,
  });
  if (resolved.technology && getTechnologyBrandSlug(resolved.technology)) return true;
  return Boolean(
    resolveAutoCloudIcon({
      label: data.label,
      typeId: data.typeId ?? data.componentType,
      componentId: (data as ShapeNodeData & { componentId?: string }).componentId,
      technology: data.technology,
      serviceType: data.serviceType,
      icon: data.icon,
    }),
  );
}

export interface ShapeNodeData {
  label: string;
  sublabel?: string;
  /** Alias of `sublabel` written by planTranslator / buildReactFlow. */
  subtitle?: string;
  shape: ShapeType;
  color?: string;
  accentColor?: string;
  category?: string;
  componentType?: string;
  typeId?: string;
  icon?: string;
  iconSource?: string;
  technology?: string;
  serviceType?: string;
  nodeWidth?: number;
  nodeHeight?: number;
  showIcon?: boolean;
  /** true = icon only, false = always show label, undefined = auto (brand logos hide label). */
  iconOnly?: boolean;
  /** Vertical drum (database) vs horizontal pipe (queue / pub-sub). */
  cylinderAxis?: 'vertical' | 'horizontal';
}

/** Fit to optical grid; wrap long labels inside the silhouette mid-band. */
function resolveShapeSize(data: ShapeNodeData): { width: number; height: number; labelMaxWidth: number } {
  const { width, height } = resolveShapeNodeDimensions(data);
  return {
    width,
    height,
    labelMaxWidth: getShapeLabelMaxWidth(data.shape, width, 'title'),
  };
}

const HANDLE_STYLE = (color: string) => ({
  width: 12,
  height: 12,
  background: 'var(--node-card-bg, #ffffff)',
  border: `2px solid ${color}`,
  borderRadius: '50%',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
});

/** Renders exactly 2 handles per side (one source, one target). */
function Handles({
  color,
  nodeId,
}: {
  color: string;
  nodeId: string;
}) {
  const updateNodeInternals = useUpdateNodeInternals();
  const s = HANDLE_STYLE(color);

  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  return <NodeHandles handleStyle={s} nodeId={nodeId} />;
}

function Label({
  data,
  color,
  nodeId,
  width,
  height,
  maxWidth,
  shape,
}: {
  data: ShapeNodeData;
  color: string;
  nodeId: string;
  width: number;
  height: number;
  maxWidth?: number;
  shape?: ShapeType;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconMode = useDiagramStore((s) => s.iconMode);
  const layout = resolveShapeLabelLayout(shape, data, iconMode);
  const labelEdit = useInlineLabelEdit({
    nodeId,
    currentLabel: data.label || '',
    containerRef,
  });
  const resolvedIcon = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology,
    category: data.category,
    icon: data.icon,
    color,
  });
  const providerIcon =
    shape === 'diamond'
      ? null
      : resolveAutoCloudIcon({
          label: data.label,
          typeId: data.typeId ?? data.componentType,
          componentId: (data as ShapeNodeData & { componentId?: string }).componentId,
          technology: data.technology,
          serviceType: data.serviceType,
          icon: data.icon,
        });
  const iconSizes = shape === 'diamond' ? ICON_SIZE.diamond : ICON_SIZE;
  const brandTechnology = resolvedIcon.technology && getTechnologyBrandSlug(resolvedIcon.technology)
    ? resolvedIcon.technology
    : undefined;
  const hasBrandLogo = Boolean(brandTechnology) || Boolean(providerIcon);
  const isIconBrand = layout === 'icon-brand';
  const isPipeText = layout === 'pipe-text';
  const cloudIconSize = Math.max(
    iconSizes.cloudMin,
    Math.round(Math.min(width * (shape === 'diamond' ? 0.2 : 0.3), height - (shape === 'diamond' ? 28 : 20))),
  );
  const prominentGlyphSize = prominentIconGlyphSize();
  const iconSlotSize = isIconBrand ? PROMINENT_ICON_SLOT_PX : (providerIcon ? cloudIconSize : iconSizes.box);
  const iconGlyphSize = isIconBrand
    ? prominentGlyphSize
    : providerIcon
      ? Math.round(cloudIconSize * 0.78)
      : iconSizes.node;
  const iconModeAllows = iconMode !== 'off';
  const showIcon = isPipeText
    ? false
    : isIconBrand
      ? iconModeAllows && (hasBrandLogo || resolveNodeIconVisibility(iconMode, data.showIcon, resolvedIcon.source === 'manual'))
      : resolveNodeIconVisibility(iconMode, data.showIcon, resolvedIcon.source === 'manual');
  const sublabel = data.sublabel ?? data.subtitle;
  const pipeLineCount = isPipeText ? countPipeLabelLines(data.label, sublabel) : 1;
  const isPipeMultiline = isPipeText && pipeLineCount > 1;
  const sublabelMaxWidth = getShapeLabelMaxWidth(shape, width, 'subtitle');
  const labelNudge = getDiamondLabelNudge(shape, showIcon && !isIconBrand, Boolean(sublabel));
  const autoIconOnly = isIconBrand && showIcon && hasBrandLogo;
  const iconOnly =
    data.iconOnly === true ? showIcon
      : data.iconOnly === false ? false
        : autoIconOnly;
  const showTitle = !iconOnly && Boolean(data.label?.trim());
  const showSubtitle = !iconOnly && Boolean(sublabel?.trim());

  const iconGlyph = providerIcon ? (
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
    />
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center text-center px-1 select-none"
      onDoubleClick={iconOnly ? labelEdit.startEdit : undefined}
      style={{
        width: '100%',
        maxWidth: maxWidth ?? '100%',
        transform: labelNudge ? `translateY(${labelNudge}px)` : undefined,
        padding: isPipeText ? '0 12px' : undefined,
        cursor: iconOnly ? 'text' : undefined,
      }}
    >
      {showIcon && (
      <div
        className={isIconBrand ? undefined : 'node-icon-box mb-1'}
        aria-hidden="true"
        style={{
          width: iconSlotSize,
          height: iconSlotSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginBottom: isIconBrand ? (showTitle ? 4 : 0) : 4,
          ...(providerIcon && !isIconBrand
            ? { borderRadius: Math.round(iconSlotSize * 0.27) }
            : {}),
          ...(isIconBrand ? { background: 'transparent', boxShadow: 'none' } : {}),
        }}
      >
        <div
          style={{
            width: isIconBrand ? Math.round(PROMINENT_ICON_SLOT_PX * PROMINENT_ICON_GLYPH_RATIO) : '100%',
            height: isIconBrand ? Math.round(PROMINENT_ICON_SLOT_PX * PROMINENT_ICON_GLYPH_RATIO) : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {iconGlyph}
        </div>
      </div>
      )}
      {labelEdit.isEditing ? (
        <input
          {...labelEdit.inputProps}
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--node-title-color, hsl(var(--foreground)))',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            lineHeight: 1.25,
            letterSpacing: '-0.015em',
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
            borderRadius: 3,
            boxShadow: `0 0 0 2px ${color}`,
            cursor: 'text',
          }}
        />
      ) : showTitle ? (
        <span
          className="node-title"
          onDoubleClick={labelEdit.startEdit}
          style={{
            cursor: 'text',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: isPipeMultiline ? 'pre-line' : isPipeText ? 'nowrap' : 'normal',
            maxWidth: '100%',
            textAlign: 'center',
            flex: 'none',
            fontSize: isIconBrand ? 11 : isPipeText ? 11 : undefined,
            fontWeight: isIconBrand ? 500 : undefined,
            lineHeight: isPipeMultiline ? 1.15 : undefined,
            textOverflow: isPipeText && !isPipeMultiline ? 'ellipsis' : undefined,
            overflow: isPipeText && !isPipeMultiline ? 'hidden' : undefined,
          }}
        >
          {data.label}
        </span>
      ) : null}
      {showSubtitle && (
        <span
          className="node-subtitle"
          style={{
            maxWidth: sublabelMaxWidth,
            overflowWrap: 'anywhere',
            marginTop: 2,
            textAlign: 'center',
            fontSize: shape === 'diamond' || shape === 'circle' ? 10 : isPipeText ? 10 : undefined,
            lineHeight: 1.2,
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}

function Backplates({ layers, borderRadius }: { layers: { offset: number; color: string }[], borderRadius: number | string }) {
  return (
    <>
      {layers.map((layer, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: borderRadius,
            transform: `translate(${layer.offset}px, ${layer.offset}px)`,
            background: layer.color,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

/** Shared card surface — rectangles and SVG silhouettes use the same tokens. */
function resolveShapeSurface(
  isDark: boolean,
  styles: NodeStyleConfig,
  selected: boolean,
  accentColor: string,
) {
  const fill = isDark ? styles.background : '#ffffff';
  const stroke = selected
    ? accentColor
    : isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(15, 23, 42, 0.14)';
  const strokeWidth = selected ? 2 : 1.25;
  const boxShadow = selected ? styles.shadowSelected : styles.shadow;
  const dropShadow = isDark
    ? selected
      ? 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))'
      : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35))'
    : selected
      ? 'drop-shadow(0 2px 8px rgba(15, 23, 42, 0.06))'
      : 'drop-shadow(0 1px 2px rgba(15, 23, 42, 0.04))';
  return { fill, stroke, strokeWidth, boxShadow, dropShadow };
}

const SVG_SURFACE_STYLE = (width: number, height: number) => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width,
  height,
  overflow: 'visible' as const,
  transition: 'filter 0.15s ease',
  pointerEvents: 'none' as const,
});

type ShapeShellProps = {
  id: string;
  data: ShapeNodeData;
  selected: boolean;
  backplates: { offset: number; color: string }[];
  isDark: boolean;
  styles: NodeStyleConfig;
  width: number;
  height: number;
  labelMaxWidth: number;
};

// ── Individual shape renderers ────────────────────────────────────────────────

function Rectangle({ id, data, selected, rounded, backplates, isDark, styles, width, height, labelMaxWidth }: ShapeShellProps & { rounded: boolean }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const r = rounded ? 10 : 6;
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: `${surface.strokeWidth}px solid ${surface.stroke}`,
          background: surface.fill,
          boxShadow: surface.boxShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape={data.shape} />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

function Diamond({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const points = `${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={points} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <polygon
          points={points}
          fill={surface.fill}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          clipPath: diamondClipPath(W, H),
        }}
      >
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="diamond" />
      </div>
    </div>
  );
}

function Cylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const axis = resolveCylinderAxis(data);
  if (axis === 'horizontal') {
    return (
      <HorizontalPipeCylinder
        id={id}
        data={data}
        selected={selected}
        backplates={backplates}
        isDark={isDark}
        styles={styles}
        width={W}
        height={H}
        labelMaxWidth={labelMaxWidth}
      />
    );
  }
  return (
    <VerticalDrumCylinder
      id={id}
      data={data}
      selected={selected}
      backplates={backplates}
      isDark={isDark}
      styles={styles}
      width={W}
      height={H}
      labelMaxWidth={labelMaxWidth}
    />
  );
}

function cylinderShades(isDark: boolean, styles: NodeStyleConfig) {
  const topHighlight = isDark ? '#2a3040' : '#ffffff';
  const bodyShade = isDark ? styles.background : '#f1f5f9';
  const sideShade = isDark ? '#161922' : '#e8edf2';
  const sideEdge = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.22)';
  const hiddenEdge = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(148, 163, 184, 0.55)';
  return { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge };
}

function VerticalDrumCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge } = cylinderShades(isDark, styles);
  const RY = Math.max(10, Math.round(H * 0.12));
  const rx = (W - 4) / 2;
  const cx = W / 2;
  const left = 2;
  const right = W - 2;
  const topY = RY;
  const bottomY = H - RY;
  const silhouette = [
    `M ${left} ${topY}`,
    `L ${left} ${bottomY}`,
    `A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`,
    `L ${right} ${topY}`,
    `A ${rx} ${RY} 0 0 1 ${left} ${topY}`,
    'Z',
  ].join(' ');
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50% / 15%', transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <defs>
          <linearGradient id={`cyl-body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={bodyShade} />
          </linearGradient>
          <linearGradient id={`cyl-sides-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={sideShade} />
            <stop offset="14%" stopColor={bodyShade} />
            <stop offset="86%" stopColor={bodyShade} />
            <stop offset="100%" stopColor={sideShade} />
          </linearGradient>
          <linearGradient id={`cyl-cap-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={isDark ? '#1c2030' : '#f1f5f9'} />
          </linearGradient>
        </defs>
        <path d={silhouette} fill={bodyShade} stroke="none" opacity={isDark ? 0.98 : 0.94} />
        <rect x={left} y={topY} width={W - 4} height={bottomY - topY} fill={`url(#cyl-body-${id})`} stroke="none" opacity={0.85} />
        <ellipse cx={cx} cy={bottomY} rx={rx} ry={RY} fill={sideShade} stroke="none" />
        {/* Back rim (upper arc, hidden behind body) — dashed; front rim (lower arc) — solid */}
        <path
          d={`M ${left} ${bottomY} A ${rx} ${RY} 0 0 1 ${right} ${bottomY}`}
          fill="none"
          stroke={hiddenEdge}
          strokeWidth={surface.strokeWidth}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d={`M ${left} ${bottomY} A ${rx} ${RY} 0 0 0 ${right} ${bottomY}`}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinecap="round"
        />
        <line x1={left} y1={topY} x2={left} y2={bottomY} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <line x1={right} y1={topY} x2={right} y2={bottomY} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <ellipse
          cx={cx}
          cy={topY}
          rx={rx}
          ry={RY}
          fill={`url(#cyl-cap-${id})`}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
        <path
          d={silhouette}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" />
      </div>
    </div>
  );
}

function HorizontalPipeCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const { topHighlight, bodyShade, sideShade, sideEdge, hiddenEdge } = cylinderShades(isDark, styles);
  const inset = 2;
  const R = Math.max(8, Math.round((H - inset * 2) / 2));
  const midY = H / 2;
  const leftCx = inset + R;
  const rightCx = W - inset - R;
  const bodyTop = midY - R;
  const bodyBot = midY + R;
  const bodyW = Math.max(0, rightCx - leftCx);

  const silhouette = [
    `M ${leftCx - R} ${midY}`,
    `A ${R} ${R} 0 0 1 ${leftCx} ${bodyTop}`,
    `L ${rightCx} ${bodyTop}`,
    `A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`,
    `L ${leftCx} ${bodyBot}`,
    `A ${R} ${R} 0 0 1 ${leftCx - R} ${midY}`,
    'Z',
  ].join(' ');

  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: 999, transform: `translate(${layer.offset}px, ${layer.offset}px)`, background: layer.color, zIndex: -1 }} />
      ))}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <defs>
          <linearGradient id={`pipe-body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="55%" stopColor={bodyShade} />
            <stop offset="100%" stopColor={sideShade} />
          </linearGradient>
          <radialGradient id={`pipe-cap-${id}`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor={topHighlight} />
            <stop offset="100%" stopColor={bodyShade} />
          </radialGradient>
        </defs>

        {/* Tube body — rectangle only, no solid disc on the far end */}
        {bodyW > 0 && (
          <rect
            x={leftCx}
            y={bodyTop}
            width={bodyW}
            height={R * 2}
            fill={`url(#pipe-body-${id})`}
            stroke="none"
          />
        )}

        {/* Side wall lines */}
        <line x1={leftCx} y1={bodyTop} x2={rightCx} y2={bodyTop} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
        <line x1={leftCx} y1={bodyBot} x2={rightCx} y2={bodyBot} stroke={sideEdge} strokeWidth={surface.strokeWidth} strokeLinecap="round" />

        {/* Far opening: back rim dashed, front rim solid — no filled end cap */}
        <path
          d={`M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 0 ${rightCx} ${bodyBot}`}
          fill="none"
          stroke={hiddenEdge}
          strokeWidth={surface.strokeWidth}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d={`M ${rightCx} ${bodyTop} A ${R} ${R} 0 0 1 ${rightCx} ${bodyBot}`}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinecap="round"
        />

        {/* Near opening — solid face disc (looking into the pipe) */}
        <ellipse
          cx={leftCx}
          cy={midY}
          rx={R}
          ry={R}
          fill={`url(#pipe-cap-${id})`}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />

        {/* Outer silhouette */}
        <path
          d={silhouette}
          fill="none"
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: R + 6, paddingRight: R + 10 }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" />
      </div>
    </div>
  );
}

function Circle({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <ellipse
          cx={W / 2} cy={H / 2} rx={W / 2 - 2} ry={H / 2 - 2}
          fill={surface.fill}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          clipPath: `ellipse(${(W / 2) - 4}px ${(H / 2) - 4}px at ${W / 2}px ${H / 2}px)`,
        }}
      >
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="circle" />
      </div>
    </div>
  );
}

function Parallelogram({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const SKEW = Math.min(20, Math.round(W * 0.08));
  const pts = `${SKEW},2 ${W - 2},2 ${W - SKEW - 2},${H - 2} 2,${H - 2}`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
       {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <polygon
          points={pts}
          fill={surface.fill}
          stroke={surface.stroke}
          strokeWidth={surface.strokeWidth}
        />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="parallelogram" />
      </div>
    </div>
  );
}

/** Flat-top hexagon — ingress / load balancers / gateways. */
function Hexagon({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const inset = 2;
  const qx = Math.max(10, Math.round(W * 0.22));
  const pts = [
    `${qx},${inset}`,
    `${W - qx},${inset}`,
    `${W - inset},${H / 2}`,
    `${W - qx},${H - inset}`,
    `${qx},${H - inset}`,
    `${inset},${H / 2}`,
  ].join(' ');
  const clip = `polygon(${pts})`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={pts} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <polygon points={pts} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: clip }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="hexagon" />
      </div>
    </div>
  );
}

/**
 * Soft cloud outline — external / SaaS / third-party. Bumps scaled uniformly
 * from a 200×110 reference so arcs stay round across the 200–240 grid.
 */
function cloudSilhouette(W: number): string {
  const s = W / 200;
  const pt = (x: number, y: number) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`;
  const R = (r: number) => (r * s).toFixed(1);
  return [
    `M ${pt(44, 102)}`,
    `A ${R(26)} ${R(26)} 0 0 1 ${pt(34, 68)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(82, 34)}`,
    `A ${R(34)} ${R(34)} 0 0 1 ${pt(148, 42)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(170, 78)}`,
    `A ${R(24)} ${R(24)} 0 0 1 ${pt(156, 102)}`,
    'Z',
  ].join(' ');
}

function Cloud({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#57534e';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const d = cloudSilhouette(W);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <path d={d} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cloud" />
      </div>
    </div>
  );
}

/** Rounded shield — auth, WAF, secrets, Vault. */
function Shield({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#7c3aed';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const inset = 2;
  const topY = Math.max(5, Math.round(H * 0.05));
  const d = [
    `M ${W / 2} ${topY}`,
    `L ${W - inset} ${Math.round(H * 0.3)}`,
    `Q ${W - inset} ${Math.round(H * 0.62)} ${W / 2} ${H - inset}`,
    `Q ${inset} ${Math.round(H * 0.62)} ${inset} ${Math.round(H * 0.3)}`,
    'Z',
  ].join(' ');
  const clip = `polygon(${W / 2}px ${topY}px, ${W - inset}px ${Math.round(H * 0.3)}px, ${W / 2}px ${H - inset}px, ${inset}px ${Math.round(H * 0.3)}px)`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <path d={d} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <path d={d} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinejoin="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: clip }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="shield" />
      </div>
    </div>
  );
}

/** Person glyph — end users / actors. Icon-friendly, label below head. */
function Actor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#475569';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const headCY = Math.round(H * 0.3);
  const headR = Math.max(8, Math.round(H * 0.17));
  const shoulderY = Math.round(H * 0.95);
  const shoulderSweepX = Math.round(W * 0.28);
  const d = [
    `M ${W / 2 - shoulderSweepX} ${shoulderY}`,
    `A ${shoulderSweepX} ${Math.round(H * 0.22)} 0 0 1 ${W / 2 + shoulderSweepX} ${shoulderY}`,
    'Z',
  ].join(' ');
  const clip = `ellipse(${W / 2 - 2}px ${H / 2 - 2}px at ${W / 2}px ${H / 2}px)`;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 2} ry={H / 2 - 2} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <circle cx={W / 2} cy={headCY} r={headR} fill="none" stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <path d={d} fill="none" stroke={surface.stroke} strokeWidth={surface.strokeWidth} strokeLinecap="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: clip }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="actor" />
      </div>
    </div>
  );
}

/** Minimal monitor — web / desktop clients. Rounded screen + stand notch. */
function Monitor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const inset = 2;
  const screenH = H - 20;
  const screenR = 6;
  const screen: React.SVGProps<SVGPathElement> = {
    d: `M ${inset} ${inset + screenR} Q ${inset} ${inset} ${inset + screenR} ${inset} L ${W - inset - screenR} ${inset} Q ${W - inset} ${inset} ${W - inset} ${inset + screenR} L ${W - inset} ${inset + screenH} Q ${W - inset} ${inset + screenH} ${W - inset - 4} ${inset + screenH} L ${inset + 4} ${inset + screenH} Q ${inset} ${inset + screenH} ${inset} ${inset + screenH} Z`,
    fill: surface.fill,
    stroke: surface.stroke,
    strokeWidth: surface.strokeWidth,
    strokeLinejoin: 'round',
  };
  const neckY = inset + screenH;
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <path {...screen} />
        <line x1={W / 2} y1={neckY} x2={W / 2} y2={neckY + 6} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <rect x={W / 2 - Math.round(W * 0.16)} y={neckY + 6} width={Math.round(W * 0.32)} height={3} rx={1.5} fill={surface.stroke} />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="monitor" />
      </div>
    </div>
  );
}

/** Tall phone — mobile clients. Rounded rect + speaker notch. */
function Mobile({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const inset = 2;
  const r = Math.max(6, Math.round(W * 0.09));
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }}>
        <rect x={inset} y={inset} width={W - inset * 2} height={H - inset * 2} rx={r} fill={surface.fill} stroke={surface.stroke} strokeWidth={surface.strokeWidth} />
        <rect x={W / 2 - 8} y={Math.round(H * 0.1)} width={16} height={3} rx={1.5} fill={surface.stroke} opacity={0.7} />
        <line x1={W / 2} y1={H - Math.round(H * 0.12)} x2={W / 2} y2={H - Math.round(H * 0.05)} stroke={surface.stroke} strokeWidth={2} strokeLinecap="round" />
      </svg>
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="mobile" />
      </div>
    </div>
  );
}

/** Out-of-system / optional scope — dashed border, near-transparent fill. */
function DashedRectangle({ id, data, selected, isDark, styles, width, height, labelMaxWidth }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#64748b';
  const surface = resolveShapeSurface(isDark, styles, selected, color);
  const r = 10;
  return (
    <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
      <div
        style={{
          width,
          height,
          borderRadius: r,
          border: `${surface.strokeWidth}px dashed ${surface.stroke}`,
          background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape="dashed-rectangle" />
      </div>
      <Handles color={color} nodeId={id} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const { isDark } = useCanvasTheme();
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const backplates = styles.backplates;
  const { width, height, labelMaxWidth } = resolveShapeSize(data);
  const sized = { width, height, labelMaxWidth };
  const updateNodeInternals = useUpdateNodeInternals();
  const updateNodeSize = useDiagramStore((s) => s.updateNodeSize);
  const storedWidth = useDiagramStore((s) => s.nodes.find((n) => n.id === id)?.width);
  const storedHeight = useDiagramStore((s) => s.nodes.find((n) => n.id === id)?.height);

  useLayoutEffect(() => {
    if (storedWidth === width && storedHeight === height) return;
    updateNodeSize(id, { width, height });
  }, [id, width, height, storedWidth, storedHeight, updateNodeSize]);

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, width, height, updateNodeInternals]);

  const shellProps = {
    id,
    data,
    selected: !!selected,
    backplates,
    isDark,
    styles,
    ...sized,
  };

  const renderShape = () => {
    switch (data.shape) {
      case 'diamond':          return <Diamond {...shellProps} />;
      case 'cylinder':         return <Cylinder {...shellProps} />;
      case 'circle':           return <Circle {...shellProps} />;
      case 'parallelogram':    return <Parallelogram {...shellProps} />;
      case 'hexagon':          return <Hexagon {...shellProps} />;
      case 'cloud':            return <Cloud {...shellProps} />;
      case 'shield':           return <Shield {...shellProps} />;
      case 'actor':            return <Actor {...shellProps} />;
      case 'monitor':          return <Monitor {...shellProps} />;
      case 'mobile':           return <Mobile {...shellProps} />;
      case 'dashed-rectangle': return <DashedRectangle {...shellProps} />;
      case 'rounded-rectangle': return <Rectangle {...shellProps} rounded />;
      default:                 return <Rectangle {...shellProps} rounded={false} />;
    }
  };

  return renderShape();
}

export const ShapeNode = memo(ShapeNodeComponent);
