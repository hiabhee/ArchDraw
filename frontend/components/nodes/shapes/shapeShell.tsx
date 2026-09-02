'use client';

import { useEffect, useRef } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import {
  ICON_SIZE,
  PROMINENT_ICON_SLOT_PX,
  PROMINENT_ICON_GLYPH_RATIO,
  prominentIconGlyphSize,
  type NodeStyleConfig,
} from '@/lib/theme/stylingConstants';
import { countPipeLabelLines } from '@/lib/utils/nodeSizing';
import {
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
import { type ShapeType } from '@/lib/shapeRegistry';
import { getShapePrimitives, type ShapeGeometryAxis } from '@/lib/theme/shapeGeometry';
import {
  applyShapeSurface,
  getStrokeRenderer,
  resolveRenderSurface,
  renderSketchSurface,
  BRUTAL_SHADOW_FILTER,
  type RenderSurface,
  type ShapePrimitive,
} from '@/lib/theme/renderStyles';
import type { ShapeNodeData } from './types';
import { resolveShapeLabelLayout } from './labelLayout';

export const HANDLE_STYLE = (_color: string) => ({
  width: 10,
  height: 10,
  background: '#0f172a',
  border: `1.5px solid #475569`,
  borderRadius: '50%',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease',
});

/** Renders exactly 2 handles per side (one source, one target). */
export function Handles({
  color,
  nodeId,
  shape,
}: {
  color: string;
  nodeId: string;
  shape?: string;
}) {
  const updateNodeInternals = useUpdateNodeInternals();
  const s = HANDLE_STYLE(color);

  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  return <NodeHandles handleStyle={s} nodeId={nodeId} />;
}

export function Label({
  data,
  color,
  nodeId,
  width,
  height,
  maxWidth,
  shape,
  sketch = false,
  brutal = false,
}: {
  data: ShapeNodeData;
  color: string;
  nodeId: string;
  width: number;
  height: number;
  maxWidth?: number;
  shape?: ShapeType;
  sketch?: boolean;
  brutal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconMode = useDiagramStore((s) => s.iconMode);
  const layout = resolveShapeLabelLayout(shape, data, iconMode);
  const labelEdit = useInlineLabelEdit({
    nodeId,
    currentLabel: data.label || '',
    containerRef,
    autoStart: Boolean(data.autoStartLabelEdit),
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
            fontSize: sketch ? 18 : brutal ? 16.2 : 16.2,
            fontWeight: sketch ? 400 : brutal ? 700 : 600,
            fontFamily: sketch
              ? 'var(--font-patrick-hand, "Patrick Hand"), var(--arch-font-title, cursive)'
              : brutal
                ? 'var(--arch-font-title, sans-serif)'
                : undefined,
            color: 'var(--node-title-color, hsl(var(--foreground)))',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            lineHeight: 1.25,
            letterSpacing: sketch ? '0.02em' : brutal ? '-0.02em' : '-0.015em',
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
            whiteSpace: isPipeMultiline ? 'pre-line' : isPipeText ? 'normal' : 'normal',
            maxWidth: '100%',
            textAlign: 'center',
            flex: 'none',
            fontSize: sketch ? 18 : (isIconBrand ? 13.2 : isPipeText ? 13.2 : brutal ? 16.2 : undefined),
            fontWeight: sketch ? 400 : (isIconBrand ? 500 : brutal ? 700 : undefined),
            fontFamily: sketch
              ? 'var(--font-patrick-hand, "Patrick Hand"), var(--arch-font-title, cursive)'
              : brutal
                ? 'var(--arch-font-title, sans-serif)'
                : undefined,
            letterSpacing: sketch ? '0.015em' : undefined,
            lineHeight: isPipeMultiline || isPipeText ? 1.15 : undefined,
            textOverflow: undefined,
            overflow: undefined,
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
            fontSize: sketch ? 12.5 : shape === 'diamond' || shape === 'circle' ? 10 : isPipeText ? 10 : undefined,
            lineHeight: 1.2,
            fontFamily: sketch
              ? 'var(--font-caveat, "Caveat"), var(--arch-font-subtitle, cursive)'
              : undefined,
            fontWeight: sketch ? 600 : undefined,
            letterSpacing: sketch ? '0.02em' : undefined,
            color: brutal ? 'var(--arch-subtitle, #52525b)' : undefined,
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}

export function Backplates({ layers, borderRadius }: { layers: { offset: number; color: string }[], borderRadius: number | string }) {
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
export function resolveShapeSurface(
  isDark: boolean,
  styles: NodeStyleConfig,
  selected: boolean,
  accentColor: string,
  sketch = false,
  brutal = false,
) {
  return resolveRenderSurface({
    renderStyleId: brutal ? 'neubrutalism' : sketch ? 'sketch' : 'precision',
    isDark,
    selected,
    accentColor,
    nodeStyle: styles,
  });
}

export const SVG_SURFACE_STYLE = (width: number, height: number) => ({
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
export function renderPrimitivesSvg(primitives: ShapePrimitive[], surface: RenderSurface): string {
  return applyShapeSurface(primitives, surface)
    .map((p) => getStrokeRenderer('crisp').renderPrimitive(p, 0))
    .join('\n');
}

/** Deterministic per-node seed so sketch wobble is stable across re-renders. */
export function sketchSeed(id: string): number {
  return getStrokeRenderer('rough').seedFor(id);
}

export function SketchBody({
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
  const body = renderSketchSurface({
    primitives: getShapePrimitives(shape, width, height, axis, true), // Pass true for isSketch
    surface,
    seedId: seed,
    isDark,
    shape,
  });
  return (
    <svg
      width={width}
      height={height}
      style={SVG_SURFACE_STYLE(width, height)}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/** Neubrutalism body — crisp primitives with heavy stroke + hard shadow filter. */
export function BrutalBody({
  shape,
  width,
  height,
  surface,
  axis,
}: {
  shape: ShapeType;
  width: number;
  height: number;
  surface: RenderSurface;
  axis?: ShapeGeometryAxis;
}) {
  const primitives = getShapePrimitives(shape, width, height, axis);
  const renderer = getStrokeRenderer('brutalist');
  const body = applyShapeSurface(primitives, surface)
    .map((p) => renderer.renderPrimitive(p, 0))
    .join('\n');
  return (
    <svg
      width={width}
      height={height}
      style={SVG_SURFACE_STYLE(width, height)}
      dangerouslySetInnerHTML={{ __html: `${BRUTAL_SHADOW_FILTER}${body}` }}
    />
  );
}

export type ShapeShellProps = {
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
  brutal?: boolean;
};
