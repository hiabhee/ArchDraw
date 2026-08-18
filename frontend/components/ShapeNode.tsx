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
import { getShapePrimitives, type ShapeGeometryAxis } from '@/lib/theme/shapeGeometry';
import {
  applyShapeSurface,
  getStrokeRenderer,
  resolveRenderSurface,
  renderSketchSurface,
  type RenderSurface,
  type ShapePrimitive,
} from '@/lib/theme/renderStyles';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import './nodes/nodeStyles.css';

export type { ShapeType };

export type ShapeLabelLayout = 'default' | 'icon-brand' | 'pipe-text';export function resolveShapeLabelLayout(
  shape: ShapeType | undefined,
  data: ShapeNodeData,
  iconMode: NodeIconMode,
): ShapeLabelLayout {
  if (iconMode === 'off' || !shape) return 'default';
  // Queue shape uses pipe-text layout (horizontal label)
  if (shape === 'queue') return 'pipe-text';
  // Cylinder (vertical drum) and other large shapes use icon-brand layout
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
  sketch = false,
}: {
  data: ShapeNodeData;
  color: string;
  nodeId: string;
  width: number;
  height: number;
  maxWidth?: number;
  shape?: ShapeType;
  sketch?: boolean;
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
  // Auto-hide labels for brand logos ONLY if iconMode is explicitly controlling it
  // Default behavior: always show labels alongside icons
  const autoIconOnly = false;  // Changed: never auto-hide labels
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
        padding: isPipeText ? '0 12px' : sketch ? '6px 8px' : undefined,
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
            fontSize: sketch ? 15 : 13.5,
            fontWeight: sketch ? 400 : 600,
            fontFamily: sketch ? 'var(--arch-font-title, "Nanum Pen Script", cursive)' : undefined,
            color: 'var(--node-title-color, hsl(var(--foreground)))',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            lineHeight: 1.25,
            letterSpacing: sketch ? '0.02em' : '-0.015em',
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
            fontSize: sketch ? 15 : (isIconBrand ? 11 : isPipeText ? 11 : undefined),
            fontWeight: sketch ? 400 : (isIconBrand ? 500 : undefined),
            fontFamily: sketch ? 'var(--arch-font-title, "Nanum Pen Script", cursive)' : undefined,
            letterSpacing: sketch ? '0.02em' : undefined,
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
            fontFamily: sketch ? 'var(--arch-font-subtitle, "Nanum Pen Script", cursive)' : undefined,
            fontWeight: sketch ? 400 : undefined,
            letterSpacing: sketch ? '0.02em' : undefined,
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
  sketch = false,
) {
  return resolveRenderSurface({
    renderStyleId: sketch ? 'sketch' : 'precision',
    isDark,
    selected,
    accentColor,
    nodeStyle: styles,
  });
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

/** Render style-agnostic primitives through the crisp stroke renderer. */
function renderPrimitivesSvg(primitives: ShapePrimitive[], surface: RenderSurface): string {
  return applyShapeSurface(primitives, surface)
    .map((p) => getStrokeRenderer('crisp').renderPrimitive(p, 0))
    .join('\n');
}

/** Rough (sketch) shape body — same geometry, wobbly stroke + cross-hatch fill. */
function renderSketchBodySvg(
  shape: ShapeType,
  width: number,
  height: number,
  surface: RenderSurface,
  seed: number,
  isDark: boolean,
  axis?: ShapeGeometryAxis,
): string {
  return renderSketchSurface({
    primitives: getShapePrimitives(shape, width, height, axis, true), // Pass true for isSketch
    surface,
    seedId: seed,
    isDark,
    shape,
  });
}

/** Deterministic per-node seed so sketch wobble is stable across re-renders. */
function sketchSeed(id: string): number {
  return getStrokeRenderer('rough').seedFor(id);
}

function SketchBody({
  shape,
  width,
  height,
  surface,
  seed,
  axis,
  isDark,
}: {
  shape: ShapeType;
  width: number;
  height: number;
  surface: RenderSurface;
  seed: number;
  axis?: ShapeGeometryAxis;
  isDark: boolean;
}) {
  const body = renderSketchBodySvg(shape, width, height, surface, seed, isDark, axis);
  return (
    <svg
      width={width}
      height={height}
      style={SVG_SURFACE_STYLE(width, height)}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

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
  sketch?: boolean;
};

// ── Individual shape renderers ────────────────────────────────────────────────

function Rectangle({ id, data, selected, rounded, backplates, isDark, styles, width, height, labelMaxWidth, sketch }: ShapeShellProps & { rounded: boolean }) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  const r = getShapePrimitives(rounded ? 'rounded-rectangle' : 'rectangle', width, height)[0].rx ?? 6;
  if (sketch) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius={r} />}
        <SketchBody shape={rounded ? 'rounded-rectangle' : 'rectangle'} width={width} height={height} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape={data.shape} sketch />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
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

function Diamond({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="diamond" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: diamondClipPath(W, H) }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="diamond" sketch />
        </div>
      </div>
    );
  }
  const primitives = getShapePrimitives('diamond', W, H);
  const points = primitives[0].points ?? '';
  const body = renderPrimitivesSvg(primitives, surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.map((layer, i) => (
        <svg key={i} width={W} height={H} style={{ position: 'absolute', transform: `translate(${layer.offset}px, ${layer.offset}px)`, zIndex: -1, overflow: 'visible' }}>
          <polygon points={points} fill={layer.color} />
        </svg>
      ))}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
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

function Cylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  // Cylinder is ONLY for vertical drums (databases)
  // For horizontal pipes/queues, use shape='queue' instead
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cylinder" width={W} height={H} surface={surface} seed={sketchSeed(id)} axis="vertical" isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cylinder" sketch />
        </div>
      </div>
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

function VerticalDrumCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch = false }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
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

// Legacy: HorizontalPipeCylinder kept for backward compatibility with old diagrams
// New diagrams should use shape='queue' instead of shape='cylinder' with cylinderAxis='horizontal'
function HorizontalPipeCylinder({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch = false }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
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

function Circle({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    // Scale up the rough.js body so the circle looks bigger in sketch mode.
    const sketchScale = 1.3;
    const sW = Math.round(W * sketchScale);
    const sH = Math.round(H * sketchScale);
    const offsetX = Math.round((sW - W) / 2);
    const offsetY = Math.round((sH - H) / 2);
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
        <div style={{ position: 'absolute', top: -offsetY, left: -offsetX, width: sW, height: sH, pointerEvents: 'none' }}>
          <SketchBody shape="circle" width={sW} height={sH} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        </div>
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
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="circle" sketch />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('circle', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      {backplates.length > 0 && <Backplates layers={backplates} borderRadius="50%" />}
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
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

function Parallelogram({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="parallelogram" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="parallelogram" sketch />
        </div>
      </div>
    );
  }
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
function Hexagon({ id, data, selected, backplates, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="hexagon" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="hexagon" sketch />
        </div>
      </div>
    );
  }
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

function Cloud({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#57534e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="cloud" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="cloud" sketch />
        </div>
      </div>
    );
  }
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
/** Person glyph — end users / actors. Icon-friendly, label below head. */
function Actor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#475569';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="actor" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="actor" sketch />
        </div>
      </div>
    );
  }
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
function Monitor({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="monitor" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="monitor" sketch />
        </div>
      </div>
    );
  }
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
function Mobile({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#2563eb';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="mobile" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="mobile" sketch />
        </div>
      </div>
    );
  }
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
function DashedRectangle({ id, data, selected, isDark, styles, width, height, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#64748b';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width, height, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="dashed-rectangle" width={width} height={height} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={width} height={height} maxWidth={labelMaxWidth} shape="dashed-rectangle" sketch />
        </div>
        <Handles color={color} nodeId={id} />
      </div>
    );
  }
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

// ── document (single document with folded corner) ────────────────────────────

/** Document with folded corner — files, reports, configs. */
function Document({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="document" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="document" sketch />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('document', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="document" />
      </div>
    </div>
  );
}

// ── documents (stacked multiple documents) ────────────────────────────────────

/** Multiple stacked documents — document collections, file sets. */
function Documents({ id, data, selected, isDark, styles, width: W, height: H, labelMaxWidth, sketch }: ShapeShellProps) {
  const color = data.accentColor ?? data.color ?? '#0f766e';
  const surface = resolveShapeSurface(isDark, styles, selected, color, sketch);
  if (sketch) {
    return (
      <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
        <SketchBody shape="documents" width={W} height={H} surface={surface} seed={sketchSeed(id)} isDark={isDark} />
        <Handles color={color} nodeId={id} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="documents" sketch />
        </div>
      </div>
    );
  }
  const body = renderPrimitivesSvg(getShapePrimitives('documents', W, H), surface);
  return (
    <div className="shape-node" style={{ width: W, height: H, position: 'relative', zIndex: 2 }}>
      <svg width={W} height={H} style={{ ...SVG_SURFACE_STYLE(W, H), filter: surface.dropShadow }} dangerouslySetInnerHTML={{ __html: body }} />
      <Handles color={color} nodeId={id} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Label data={data} color={color} nodeId={id} width={W} height={H} maxWidth={labelMaxWidth} shape="documents" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const { isDark } = useCanvasTheme();
  const { renderStyleId } = useDiagramAesthetics();
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
    sketch: renderStyleId === 'sketch',
    ...sized,
  };

  const renderShape = () => {
    switch (data.shape) {
      case 'diamond':          return <Diamond {...shellProps} />;
      case 'cylinder':         return <Cylinder {...shellProps} />;
      case 'queue':            return <HorizontalPipeCylinder {...shellProps} />;
      case 'circle':           return <Circle {...shellProps} />;
      case 'parallelogram':    return <Parallelogram {...shellProps} />;
      case 'hexagon':          return <Hexagon {...shellProps} />;
      case 'cloud':            return <Cloud {...shellProps} />;
      case 'actor':            return <Actor {...shellProps} />;
      case 'monitor':          return <Monitor {...shellProps} />;
      case 'mobile':           return <Mobile {...shellProps} />;
      case 'dashed-rectangle': return <DashedRectangle {...shellProps} />;
      case 'document':         return <Document {...shellProps} />;
      case 'documents':        return <Documents {...shellProps} />;
      case 'rounded-rectangle': return <Rectangle {...shellProps} rounded />;
      default:                 return <Rectangle {...shellProps} rounded={false} />;
    }
  };

  return renderShape();
}

export const ShapeNode = memo(ShapeNodeComponent);
