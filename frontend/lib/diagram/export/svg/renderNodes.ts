import {
  STATUS_COLORS,
  getConcernColor,
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
  STROKE_WIDTH,
  BORDER_RADIUS,
} from '@/lib/theme/stylingConstants';
import { resolveCylinderAxis } from '@/lib/diagram/nodes/cylinderAxis';
import { semanticShapeBodySvg } from '@/lib/diagram/nodes/shapeSilhouetteSvg';
import { resolveTextLabelColor } from '@/lib/diagram/nodes/textSizing';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import { Fragment, isValidElement, type ReactNode } from 'react';
import { CustomNodeIcon, toCustomNodeIconName } from '@/lib/icons/CustomNodeIcon';
import { resolveNodeIcon, type NodeIconSource } from '@/lib/icons/nodeIconResolver';
import { getTechnologyBrandSlug, technologyBrandIconUrl } from '@/lib/icons/brandIcons';
import { resolveNodeIconVisibility, type NodeIconMode } from '@/lib/diagram/nodes/nodeIconVisibility';
import { shouldStackLabelVertically } from '@/lib/diagram/nodes/shapeTextLayout';
import { STUDIO_ICON_GLYPH_PX, STUDIO_ICON_WELL_PX } from '@/lib/diagram/nodes/shapeNodeDimensions';
import {
  applyShapeSurface,
  getRenderStyle,
  getStrokeRenderer,
  isStudioRenderStyle,
  renderSketchBodyMarkup,
  renderSketchSurface,
  resolveRenderSurface,
  BRUTAL_BORDER,
  BRUTAL_BORDER_DARK,
  BRUTAL_TITLE_LIGHT,
  BRUTAL_TITLE_DARK,
  BRUTAL_SUBTITLE_LIGHT,
  BRUTAL_SUBTITLE_DARK,
  BRUTAL_GROUP_FILL_LIGHT,
  BRUTAL_GROUP_FILL_DARK,
  getBrutalNodeFill,
  SKETCH_INK_LIGHT_TITLE,
  SKETCH_INK_LIGHT_SUBTITLE,
  SKETCH_INK_DARK_TITLE,
  SKETCH_INK_DARK_SUBTITLE,
  SKETCH_GROUP_FILL_LIGHT,
  SKETCH_GROUP_STROKE_LIGHT,
  SKETCH_GROUP_FILL_DARK,
  SKETCH_GROUP_STROKE_DARK,
  type DiagramRenderStyleId,
  type ShapePrimitive,
} from '@/lib/theme/renderStyles';
import {
  escapeXml,
  hexToRgba,
} from './svgPrimitives';
import type {
  SystemNodeRenderData,
  ShapeNodeData,
  TextLabelNodeData,
  AnnotationNodeData,
} from './types';

/** Serialize the app's own SVG glyph elements for browser and server export. */
function iconElementSvg(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(iconElementSvg).join('');
  if (typeof node === 'string' || typeof node === 'number') return escapeXml(String(node));
  if (!isValidElement(node)) return '';

  const props = node.props as Record<string, unknown>;
  if (node.type === Fragment) return iconElementSvg(props.children as ReactNode);
  if (typeof node.type === 'function') {
    return iconElementSvg((node.type as (props: Record<string, unknown>) => ReactNode)(props));
  }
  if (typeof node.type !== 'string') return '';

  const attributes = Object.entries(props)
    .filter(([key, value]) => key !== 'children' && key !== 'key' && value != null && typeof value !== 'function')
    .map(([key, value]) => {
      const name = key === 'className'
        ? 'class'
        : key === 'viewBox' || key === 'preserveAspectRatio'
          ? key
          : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return ` ${name}="${escapeXml(String(value))}"`;
    })
    .join('');
  return `<${node.type}${attributes}>${iconElementSvg(props.children as ReactNode)}</${node.type}>`;
}

function studioIconSvg(data: ShapeNodeData, color: string, isDark: boolean, selected = false): string {
  const resolved = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology,
    category: data.category,
    icon: data.icon,
    iconSource: data.iconSource as NodeIconSource | undefined,
    color,
    isDark,
  });
  const brandSlug = isDark && selected && resolved.source !== 'manual'
    ? getTechnologyBrandSlug(resolved.technology)
    : null;
  if (brandSlug) {
    const brandUrl = technologyBrandIconUrl(brandSlug, resolved.color);
    return `<image data-brand-icon="${escapeXml(brandSlug)}" href="${escapeXml(brandUrl)}" x="0" y="0" width="36" height="36" preserveAspectRatio="xMidYMid meet" crossorigin="anonymous" />`;
  }
  const name = toCustomNodeIconName(resolved.icon);
  return name ? `<g data-semantic-icon="${name}">${iconElementSvg(CustomNodeIcon({ name, color, size: 36 }))}</g>` : '';
}

export function renderSystemNode(
  node: SystemNodeRenderData,
  isDark: boolean,
  renderStyleId: DiagramRenderStyleId = 'precision',
  aesthetics?: import('@/lib/theme/renderStyles').ResolvedCanvasTokens,
  iconMode: NodeIconMode = 'all',
): string {
  const { x, y, width, height, data, selected } = node;
  const sketch = renderStyleId === 'sketch';

  const studio = isStudioRenderStyle(renderStyleId) && aesthetics;
  const accentColor = data.accentColor || getConcernColor(
    data.layer || data.serviceType || data.category,
    aesthetics?.concerns,
  );

  const statusColor = STATUS_COLORS[data.status || 'healthy'] || '#10B981';
  const showStatus = data.status && data.status !== 'healthy';
  const baseStyles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const styles = aesthetics
    ? {
        ...baseStyles,
        background: aesthetics.colors.nodeFill,
        border: aesthetics.colors.nodeStroke,
        titleColor: aesthetics.colors.title,
        subtitleColor: aesthetics.colors.subtitle,
        shadow: aesthetics.colors.shadow,
      }
    : baseStyles;

  let borderCol: string;
  let iconColor: string;
  let fillBg: string;
  let titleColor: string;
  let subtitleColor: string;
  let styleAttr = '';

  if (isDark) {
    borderCol = selected ? accentColor : styles.border;
    iconColor = accentColor;
    fillBg = styles.background;
    titleColor = styles.titleColor;
    subtitleColor = styles.subtitleColor;
    styleAttr = selected
      ? `style="filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));"`
      : '';
  } else {
    borderCol = selected ? accentColor : styles.border;
    iconColor = accentColor;
    fillBg = styles.background;
    titleColor = styles.titleColor;
    subtitleColor = styles.subtitleColor;
    styleAttr = selected
      ? `style="filter: drop-shadow(0 1px 2px rgba(15,23,42,0.06));"`
      : '';
  }

  if (studio) {
    borderCol = selected ? accentColor : hexToRgba(accentColor, isDark ? 0.5 : 0.36);
    iconColor = accentColor;
    fillBg = aesthetics.colors.nodeFill;
    titleColor = aesthetics.colors.title;
    subtitleColor = aesthetics.colors.subtitle;
  }

  if (sketch) {
    // Warm ink type on paper/chalk — not precision slate.
    titleColor = isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE;
    subtitleColor = isDark ? SKETCH_INK_DARK_SUBTITLE : SKETCH_INK_LIGHT_SUBTITLE;
    const surface = resolveRenderSurface({
      renderStyleId: 'sketch',
      isDark,
      selected: selected ?? false,
      accentColor,
    });
    const renderer = getStrokeRenderer('rough');
    const seed = renderer.seedFor(node.id);
    const card = renderSketchSurface({
      primitives: getShapePrimitives('rounded-rectangle', width, height),
      surface,
      seedId: seed,
      isDark,
      shape: 'rounded-rectangle',
    });
    const hand = getRenderStyle('sketch').fonts.title;

    return `
      <g transform="translate(${x}, ${y})">
        ${card}
        <g transform="translate(16, 14)">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="${iconColor}" fill-opacity="0.12" />
          <circle cx="12" cy="12" r="5" fill="${iconColor}" fill-opacity="0.85" />
          <text
            x="32" y="16"
            fill="${titleColor}"
            font-family="${hand}"
            font-size="15"
            font-weight="${sketch ? 500 : 600}"
            letter-spacing="${sketch ? '0.015em' : '-0.015em'}"
          >${escapeXml(data.label || 'Service')}</text>
        </g>
        ${data.subtitle ? `
        <text
          x="16" y="${height - 14}"
          fill="${subtitleColor}"
          fill-opacity="0.7"
          font-family="${hand}"
          font-size="11"
          font-weight="400"
          letter-spacing="0.01em"
        >${escapeXml(String(data.subtitle))}</text>` : ''}
        ${showStatus ? `
        <circle cx="${width - 14}" cy="${height - 14}" r="3" fill="${statusColor}" />` : ''}
      </g>
    `.trim();
  }

  if (renderStyleId === 'neubrutalism') {
    const border = isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER;
    const surfFill = getBrutalNodeFill(accentColor, isDark);
    const nodeTitle = isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT;
    const nodeSubtitle = isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT;
    const font = 'Space Grotesk, Inter, system-ui, sans-serif';
    const shadowId = isDark ? 'brutal-shadow-dark' : 'brutal-shadow';
    return `
    <g transform="translate(${x}, ${y})">
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${surfFill}"
        stroke="${border}"
        stroke-width="3"
        rx="6" ry="6"
        filter="url(#${shadowId})"
      />
      <rect x="0" y="10" width="4" height="${Math.max(12, height - 20)}" fill="${accentColor}" />
      <g transform="translate(16, 12)">
        <rect x="0" y="0" width="22" height="22" fill="${accentColor}" fill-opacity="0.18" />
        <circle cx="11" cy="11" r="5" fill="${accentColor}" fill-opacity="0.95" />
        <text
          x="30" y="15"
          fill="${nodeTitle}"
          font-family="${font}"
          font-size="16.2"
          font-weight="700"
          letter-spacing="-0.02em"
        >${escapeXml(data.label || 'Service')}</text>
      </g>
      ${data.subtitle ? `
      <text
        x="16" y="${height - 13}"
        fill="${nodeSubtitle}"
        font-family="${font}"
        font-size="11"
        font-weight="500"
      >${escapeXml(String(data.subtitle))}</text>` : ''}
      ${showStatus ? `
      <circle cx="${width - 16}" cy="${height - 14}" r="3.5" fill="${statusColor}" />` : ''}
    </g>
    `.trim();
  }

  if (studio) {
    const showIcon = resolveNodeIconVisibility(iconMode, data.showIcon);
    const icon = showIcon ? studioIconSvg(data as ShapeNodeData, accentColor, isDark, !!selected) : '';
    const textX = icon ? 70 : 16;
    const selectedFill = isDark && selected ? '#f7f9fc' : fillBg;
    const selectedTitle = isDark && selected ? '#111827' : titleColor;
    const selectedSubtitle = isDark && selected ? '#526174' : subtitleColor;
    const selectedBorder = isDark
      ? selected ? hexToRgba(accentColor, 0.78) : 'rgba(148,163,184,0.22)'
      : borderCol;
    const cornerRadius = isDark ? 12 : 18;
    const iconWell = isDark && selected
      ? `<rect x="10" y="8" width="48" height="48" rx="11" fill="${accentColor}" fill-opacity="0.18" stroke="${accentColor}" stroke-opacity="0.4" />`
      : `<rect x="10" y="8" width="48" height="48" rx="11" fill="${hexToRgba(accentColor, isDark ? 0.2 : 0.11)}" />`;
    return `
      <g transform="translate(${x}, ${y})">
        ${isDark && selected ? `<rect x="-3" y="-3" width="${width + 6}" height="${height + 6}" rx="15" fill="none" stroke="${accentColor}" stroke-opacity="0.16" stroke-width="6" />` : ''}
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="0.75" y="2.75" width="${width - 1.5}" height="${height - 1.5}" rx="${cornerRadius}" fill="${selectedFill}" filter="url(#archdraw-metallic-shadow)" />` : ''}
        <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="${cornerRadius}" fill="${selectedFill}" stroke="${selectedBorder}" stroke-width="1.5" />
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="${cornerRadius}" fill="url(#archdraw-metallic-sheen)" pointer-events="none" />` : ''}
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="${cornerRadius}" fill="url(#archdraw-metallic-edge)" pointer-events="none" />` : ''}
        ${icon ? `${iconWell}<g transform="translate(16, 14)">${icon}</g>` : ''}
        <text x="${textX}" y="${data.subtitle ? 29 : 39}" fill="${selectedTitle}" font-family="Inter, IBM Plex Sans, system-ui, sans-serif" font-size="16.2" font-weight="600">${escapeXml(data.label || 'Service')}</text>
        ${data.subtitle ? `<text x="${textX}" y="47" fill="${selectedSubtitle}" font-family="Inter, IBM Plex Sans, system-ui, sans-serif" font-size="10.5">${escapeXml(String(data.subtitle))}</text>` : ''}
        ${showStatus ? `<circle cx="${width - 13}" cy="${height - 13}" r="3" fill="${statusColor}" />` : ''}
      </g>
    `.trim();
  }

  const strokeW = selected ? 2 : STROKE_WIDTH;
  const rx = BORDER_RADIUS;

  return `
    <g transform="translate(${x}, ${y})">
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${fillBg}"
        stroke="${borderCol}"
        stroke-width="${strokeW}"
        rx="${rx}" ry="${rx}"
        ${styleAttr}
      />
      <rect x="0" y="10" width="3" height="${Math.max(12, height - 20)}" rx="1.5" fill="${iconColor}" opacity="0.9" />
      <g transform="translate(14, 12)">
        <rect x="0" y="0" width="22" height="22" rx="6" fill="${iconColor}" fill-opacity="0.1" />
        <circle cx="11" cy="11" r="5" fill="${iconColor}" fill-opacity="0.85" />
        <text
          x="30" y="15"
          fill="${titleColor}"
          font-family="Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif"
          font-size="16.2"
          font-weight="600"
          letter-spacing="-0.015em"
        >${escapeXml(data.label || 'Service')}</text>
      </g>
      ${data.subtitle ? `
      <text
        x="14" y="${height - 12}"
        fill="${subtitleColor}"
        font-family="Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif"
        font-size="10.5"
        font-weight="400"
      >${escapeXml(String(data.subtitle))}</text>` : ''}
      ${showStatus ? `
      <circle cx="${width - 14}" cy="${height - 14}" r="3" fill="${statusColor}" />` : ''}
    </g>
  `.trim();
}

export function renderTextLabel(node: SystemNodeRenderData, isDark: boolean): string {
  const { x, y, data } = node;

  const extData = data as TextLabelNodeData;
  const textVal = extData.text || data.label || '';

  const sizeStr = extData.fontSize || 'medium';
  const sizeMap: Record<string, number> = {
    small: 14,
    medium: 18,
    large: 26,
    heading: 36,
  };
  const fontSize = sizeMap[sizeStr] || 18;
  const fontWeight = extData.bold ? 700 : 500;
  const color = resolveTextLabelColor(data.color, isDark);

  const lines = textVal.split('\n');
  const tspanElements = lines.map((line: string, idx: number) => `
    <tspan x="4" dy="${idx === 0 ? 0 : fontSize * 1.3}">${escapeXml(line)}</tspan>
  `).join('');

  return `
    <g transform="translate(${x}, ${y})">
      <text
        x="4" y="${fontSize + 4}"
        fill="${color}"
        font-family="Inter, Roboto, system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        text-anchor="start"
      >
        ${tspanElements}
      </text>
    </g>
  `.trim();
}

export function renderAnnotationNode(node: SystemNodeRenderData, isDark: boolean): string {
  const { x, y, width, height, data, selected } = node;

  const extData = data as AnnotationNodeData;
  const bg = isDark ? '#1F2937' : '#ffffff';
  const border = isDark ? '#374151' : '#e5e7eb';
  const dividerColor = isDark ? '#374151' : '#e5e7eb';

  const title = extData.title ?? '';
  const body = extData.body ?? '';

  const titleSizeStr = extData.titleSize ?? 'heading';
  const titleBold = extData.titleBold ?? true;
  const bodySizeStr = extData.bodySize ?? 'medium';
  const bodyBold = extData.bodyBold ?? false;

  const sizeMap: Record<string, number> = {
    small: 11,
    medium: 13,
    large: 15,
    heading: 18,
  };

  const titleSize = sizeMap[titleSizeStr] || 18;
  const bodySize = sizeMap[bodySizeStr] || 13;

  const titleWeight = titleBold ? 700 : 500;
  const bodyWeight = bodyBold ? 700 : 400;

  const titleColor = isDark ? '#F1F5F9' : '#1F2937';
  const bodyColor = isDark ? '#CBD5E1' : '#4B5563';

  const dividerY = 32;

  const bodyLines = body.split('\n');
  const bodyTspans = bodyLines.map((line: string, idx: number) => `
    <tspan x="12" dy="${idx === 0 ? 0 : bodySize * 1.3}">${escapeXml(line)}</tspan>
  `).join('');

  return `
    <g transform="translate(${x}, ${y})">
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${bg}"
        stroke="${selected ? '#6366F1' : border}"
        stroke-width="${selected ? 2 : 1}"
        rx="8" ry="8"
      />
      <text
        x="12" y="20"
        fill="${titleColor}"
        font-family="Inter, Roboto, system-ui, -apple-system, sans-serif"
        font-size="${titleSize}"
        font-weight="${titleWeight}"
      >${escapeXml(title)}</text>
      <line
        x1="1" y1="${dividerY}"
        x2="${width - 1}" y2="${dividerY}"
        stroke="${dividerColor}"
        stroke-width="1"
      />
      <text
        x="12" y="${dividerY + bodySize + 8}"
        fill="${bodyColor}"
        font-family="Inter, Roboto, system-ui, -apple-system, sans-serif"
        font-size="${bodySize}"
        font-weight="${bodyWeight}"
      >
        ${bodyTspans}
      </text>
    </g>
  `.trim();
}

export function renderGroupNode(
  node: SystemNodeRenderData,
  isDark: boolean,
  renderStyleId: DiagramRenderStyleId = 'precision',
  aesthetics?: import('@/lib/theme/renderStyles').ResolvedCanvasTokens,
): string {
  const { x, y, width, height, data, selected } = node;

  const groupColor = (data as { accentColor?: string; groupColor?: string })?.accentColor ||
                    (data as { groupColor?: string })?.groupColor ||
                    (data as { color?: string })?.color ||
                    getConcernColor(
                      (data as { layer?: string; label?: string }).layer || (data as { label?: string }).label,
                      aesthetics?.concerns,
                    ) ||
                    '#0f766e';

  const sketch = renderStyleId === 'sketch';
  const brutal = renderStyleId === 'neubrutalism';
  const brutalBorder = isDark ? BRUTAL_BORDER_DARK : BRUTAL_BORDER;
  // Sketch groups are warm neutral zones (tokenized fill/stroke) so the dashed
  // box reads as a penciled boundary, not a colored swimlane; the concern tint
  // stays on the caption label and the selected state.
  // Precision was almost invisible at 0.05/0.09 — match GroupNode 0.08/0.14.
  const bgRgba = brutal
    ? (isDark ? BRUTAL_GROUP_FILL_DARK : BRUTAL_GROUP_FILL_LIGHT)
    : sketch
      ? isDark ? SKETCH_GROUP_FILL_DARK : SKETCH_GROUP_FILL_LIGHT
      : hexToRgba(groupColor, isDark ? 0.14 : 0.08);
  const borderColor = brutal
    ? brutalBorder
    : selected
      ? isDark
        ? hexToRgba(groupColor, 0.65)
        : hexToRgba(groupColor, 0.6)
      : sketch
        ? isDark ? SKETCH_GROUP_STROKE_DARK : SKETCH_GROUP_STROKE_LIGHT
        : isDark
          ? hexToRgba(groupColor, 0.42)
          : hexToRgba(groupColor, 0.35);

  const borderWidth = selected ? 1.5 : 1.25;

  const label = (data as { groupLabel?: string; label?: string })?.groupLabel ||
               (data as { label?: string })?.label || '';

  const tagText = isDark ? hexToRgba(groupColor, 0.9) : groupColor;

  let zone = '';
  if (sketch) {
    const renderer = getStrokeRenderer('rough');
    const seed = renderer.seedFor(`group-${x}-${y}`);
    zone = renderSketchBodyMarkup(
      getShapePrimitives('rounded-rectangle', width, height),
      {
        fill: bgRgba,
        stroke: borderColor,
        strokeWidth: Math.max(1.6, borderWidth * 1.15),
        fillStyle: 'hachure',
      },
      seed,
      isDark,
      'group',
    );
  } else if (brutal) {
    const shadowId = isDark ? 'brutal-shadow-dark' : 'brutal-shadow';
    zone = `
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${bgRgba}"
        stroke="${borderColor}"
        stroke-width="3"
        rx="8" ry="8"
        filter="url(#${shadowId})"
      />`;
  } else {
    zone = `
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${bgRgba}"
        stroke="${borderColor}"
        stroke-width="${borderWidth}"
        rx="12" ry="12"
      />`;
  }

  return `
    <g transform="translate(${x}, ${y})">
      ${zone}
      ${label ? `
      <text
        x="12" y="20"
        fill="${brutal ? brutalBorder : tagText}"
        font-family="${sketch ? getRenderStyle('sketch').fonts.title : brutal ? 'Space Grotesk, Inter, system-ui, sans-serif' : 'Inter, Roboto, system-ui, -apple-system, sans-serif'}"
        font-size="${sketch ? 15 : brutal ? 12 : 11}"
        font-weight="${brutal ? 700 : 500}"
        letter-spacing="${brutal ? '0.02em' : sketch ? '0.02em' : '0.04em'}"
      >${escapeXml(label)}</text>` : ''}
    </g>
  `.trim();
}

export function renderShapeNode(
  node: SystemNodeRenderData,
  isDark: boolean,
  renderStyleId: DiagramRenderStyleId = 'precision',
  aesthetics?: import('@/lib/theme/renderStyles').ResolvedCanvasTokens,
  iconMode: NodeIconMode = 'all',
): string {
  const { x, y, width: W, height: H, data, selected } = node;
  const shapeData = data as ShapeNodeData;
  const studio = isStudioRenderStyle(renderStyleId) && aesthetics;
  const shape = studio ? 'rounded-rectangle' : shapeData.shape || 'rounded-rectangle';
  const shapeHint = shapeData.category || shapeData.serviceType || shapeData.layer || (
    ['actor', 'monitor', 'mobile'].includes(shapeData.shape || '') ? 'client' :
    ['cylinder', 'cache', 'bucket'].includes(shapeData.shape || '') ? 'data' :
    shapeData.shape === 'queue' ? 'async' :
    ['cloud', 'dashed-rectangle'].includes(shapeData.shape || '') ? 'external' : 'compute'
  );
  const color = shapeData.accentColor ?? getConcernColor(shapeHint, aesthetics?.concerns);
  const sketch = renderStyleId === 'sketch';
  const baseStyles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const styles = aesthetics
    ? {
        ...baseStyles,
        background: aesthetics.colors.nodeFill,
        border: aesthetics.colors.nodeStroke,
        titleColor: aesthetics.colors.title,
        subtitleColor: aesthetics.colors.subtitle,
        shadow: aesthetics.colors.shadow,
      }
    : baseStyles;
  const surface = resolveRenderSurface({
    renderStyleId,
    isDark,
    selected: selected ?? false,
    accentColor: color,
    fillColor: studio ? (isDark && selected ? '#f7f9fc' : aesthetics.colors.nodeFill) : shapeData.fillColor,
    strokeColor: studio
      ? (selected
        ? isDark ? hexToRgba(color, 0.78) : color
        : isDark ? 'rgba(148,163,184,0.22)' : hexToRgba(color, 0.36))
      : shapeData.strokeColor,
    nodeStyle: styles,
  });
  // Sketch titles/subtitles are warm ink (brown on paper, chalk on board) —
  // not the precision slate.
  const titleColor = studio ? (isDark && selected ? '#111827' : aesthetics.colors.title) : sketch
    ? isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE
    : styles.titleColor;
  const subtitleColor = studio ? (isDark && selected ? '#526174' : aesthetics.colors.subtitle) : sketch
    ? isDark ? SKETCH_INK_DARK_SUBTITLE : SKETCH_INK_LIGHT_SUBTITLE
    : styles.subtitleColor;
  const title = shapeData.label || '';
  const subtitle = shapeData.sublabel;

  const renderer = getStrokeRenderer(sketch ? 'rough' : renderStyleId === 'neubrutalism' ? 'brutalist' : 'crisp');
  const seed = renderer.seedFor(node.id);
  const renderBody = (primitives: ShapePrimitive[]): string => {
    if (sketch) {
      return renderSketchSurface({
        primitives,
        surface,
        seedId: seed,
        isDark,
        shape,
      });
    }
    return applyShapeSurface(primitives, surface)
      .map((p) => renderer.renderPrimitive(p, seed))
      .join('\n');
  };

  let body = '';
  switch (shape) {
    case 'diamond':
    case 'circle':
    case 'parallelogram':
      body = renderBody(getShapePrimitives(shape, W, H));
      break;
    case 'cylinder': {
      // Same primitives as the canvas cylinders (verticalDrumGeometry /
      // horizontalPipeGeometry). The export previously hand-drew a simplified
      // drum/pipe that dropped the rims, side walls and outline.
      const axis = resolveCylinderAxis(shapeData);
      body = renderBody(getShapePrimitives('cylinder', W, H, axis, renderStyleId === 'sketch'));
      break;
    }
    default: {
      const semantic = semanticShapeBodySvg(shape, W, H, surface, isDark, renderStyleId);
      if (semantic) {
        body = semantic;
        break;
      }
      const rounded = shape === 'rounded-rectangle';
      body = renderBody(getShapePrimitives(rounded ? 'rounded-rectangle' : 'rectangle', W, H));
    }
  }

  const brutal = renderStyleId === 'neubrutalism';
  // Brutal shadow id must invert in dark (light shadow on dark canvas)
  if (brutal && isDark) {
    body = body.split('url(#brutal-shadow)').join('url(#brutal-shadow-dark)');
  }

  const titleY = subtitle ? H / 2 - 4 : H / 2 + 4;
  const subtitleY = H / 2 + 12;
  const fontFamily = getRenderStyle(renderStyleId).fonts.title;
  // Sketch subtitles read as penciled secondary text — lighter, smaller, muted.
  const titleFontSize = sketch ? 18 : 16.2;  // Increased from 14 for better prominence
  const subtitleFontSize = sketch ? 11 : 10.5;  // Reduced from 11.5 for better hierarchy
  const subtitleFillOpacity = sketch ? 0.7 : 1;  // Reduced from 0.75 for more subtlety

  if (studio) {
    const showIcon = resolveNodeIconVisibility(iconMode, shapeData.showIcon);
    const icon = showIcon ? studioIconSvg(shapeData, color, isDark, !!selected) : '';
    const stackIcon = Boolean(icon) && shouldStackLabelVertically(W, STUDIO_ICON_WELL_PX);
    const iconX = stackIcon ? (W - STUDIO_ICON_WELL_PX) / 2 : 6;
    const contentHeight = STUDIO_ICON_WELL_PX + (title ? 18 : 0) + (subtitle ? 14 : 0);
    const iconY = stackIcon ? Math.max(4, (H - contentHeight) / 2) : 8;
    const textX = icon && !stackIcon ? iconX + STUDIO_ICON_WELL_PX + 8 : W / 2;
    const titleY = stackIcon ? iconY + STUDIO_ICON_WELL_PX + 17 : subtitle ? 29 : 39;
    const subtitleY = stackIcon ? titleY + 14 : 47;
    const iconWell = isDark && selected
      ? `<rect x="${iconX}" y="${iconY}" width="${STUDIO_ICON_WELL_PX}" height="${STUDIO_ICON_WELL_PX}" rx="11" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.4" />`
      : `<rect x="${iconX}" y="${iconY}" width="${STUDIO_ICON_WELL_PX}" height="${STUDIO_ICON_WELL_PX}" rx="11" fill="${hexToRgba(color, isDark ? 0.2 : 0.11)}" />`;
    const iconGlyphX = iconX + (STUDIO_ICON_WELL_PX - STUDIO_ICON_GLYPH_PX) / 2;
    const iconGlyphY = iconY + (STUDIO_ICON_WELL_PX - STUDIO_ICON_GLYPH_PX) / 2;
    return `
      <g transform="translate(${x}, ${y})">
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="1" y="3" width="${W - 2}" height="${H - 2}" rx="16" fill="${surface.fill}" filter="url(#archdraw-metallic-shadow)" />` : ''}
        ${body}
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="url(#archdraw-metallic-sheen)" pointer-events="none" />` : ''}
        ${aesthetics.render.nodeMaterial === 'metallic' ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="url(#archdraw-metallic-edge)" pointer-events="none" />` : ''}
        ${icon ? `${iconWell}<g transform="translate(${iconGlyphX}, ${iconGlyphY})">${icon}</g>` : ''}
        ${title ? `<text x="${textX}" y="${titleY}" fill="${titleColor}" font-family="${fontFamily}" font-size="16.2" font-weight="600" text-anchor="${icon && !stackIcon ? 'start' : 'middle'}">${escapeXml(title)}</text>` : ''}
        ${subtitle ? `<text x="${textX}" y="${subtitleY}" fill="${subtitleColor}" font-family="${fontFamily}" font-size="10.5" text-anchor="${icon && !stackIcon ? 'start' : 'middle'}">${escapeXml(subtitle)}</text>` : ''}
      </g>
    `.trim();
  }

  return `
    <g transform="translate(${x}, ${y})">
      ${body}
      ${title ? `
      <text
        x="${W / 2}" y="${titleY}"
        fill="${titleColor}"
        font-family="${fontFamily}"
        font-size="${titleFontSize}"
        font-weight="${sketch ? 500 : brutal ? 700 : 600}"
        text-anchor="middle"
        letter-spacing="${sketch ? '0.015em' : brutal ? '-0.02em' : '-0.015em'}"
      >${escapeXml(title)}</text>` : ''}
      ${subtitle ? `
      <text
        x="${W / 2}" y="${subtitleY}"
        fill="${subtitleColor}"
        fill-opacity="${subtitleFillOpacity}"
        font-family="${fontFamily}"
        font-size="${subtitleFontSize}"
        font-weight="400"
        text-anchor="middle"
        letter-spacing="${sketch ? '0.01em' : '0'}"
      >${escapeXml(subtitle)}</text>` : ''}
    </g>
  `.trim();
}
