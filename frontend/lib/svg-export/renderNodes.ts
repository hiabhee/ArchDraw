import {
  STATUS_COLORS,
  getConcernColor,
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
  STROKE_WIDTH,
  BORDER_RADIUS,
} from '@/lib/theme/stylingConstants';
import { resolveCylinderAxis } from '@/lib/utils/cylinderAxis';
import { semanticShapeBodySvg } from '@/lib/utils/shapeSilhouetteSvg';
import { resolveTextLabelColor } from '@/lib/utils/textSizing';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import {
  applyShapeSurface,
  getRenderStyle,
  getStrokeRenderer,
  renderSketchBodyMarkup,
  renderSketchSurface,
  resolveRenderSurface,
  BRUTAL_BORDER,
  BRUTAL_BORDER_DARK,
  BRUTAL_FILL_LIGHT,
  BRUTAL_FILL_DARK,
  BRUTAL_TITLE_LIGHT,
  BRUTAL_TITLE_DARK,
  BRUTAL_SUBTITLE_LIGHT,
  BRUTAL_SUBTITLE_DARK,
  BRUTAL_GROUP_FILL_LIGHT,
  BRUTAL_GROUP_FILL_DARK,
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
import {
  getTierColorNormalized,
  getDarkCategoryStyle,
} from './nodeLayout';
import type {
  SystemNodeRenderData,
  ShapeNodeData,
  TextLabelNodeData,
  AnnotationNodeData,
} from './types';

export function renderSystemNode(
  node: SystemNodeRenderData,
  isDark: boolean,
  renderStyleId: DiagramRenderStyleId = 'precision',
): string {
  const { x, y, width, height, data, selected } = node;
  const sketch = renderStyleId === 'sketch';

  const tierColor = getTierColorNormalized(data.layer);
  const accentColor = data.accentColor || data.color || tierColor || '#0f766e';

  const statusColor = STATUS_COLORS[data.status || 'healthy'] || '#10B981';
  const showStatus = data.status && data.status !== 'healthy';
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const catStyle = getDarkCategoryStyle(data.layer);

  let borderCol: string;
  let iconColor: string;
  let fillBg: string;
  let titleColor: string;
  let subtitleColor: string;
  let styleAttr = '';

  if (isDark) {
    borderCol = selected ? catStyle.border : styles.border;
    iconColor = catStyle.border;
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
    const surfFill = isDark ? BRUTAL_FILL_DARK : BRUTAL_FILL_LIGHT;
    const nodeTitle = isDark ? BRUTAL_TITLE_DARK : BRUTAL_TITLE_LIGHT;
    const nodeSubtitle = isDark ? BRUTAL_SUBTITLE_DARK : BRUTAL_SUBTITLE_LIGHT;
    const font = 'Space Grotesk, Inter, system-ui, sans-serif';
    const shadowId = isDark ? 'brutal-shadow-dark' : 'brutal-shadow';
    return `
    <g transform="translate(${x}, ${y})" filter="url(#${shadowId})">
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${surfFill}"
        stroke="${border}"
        stroke-width="3"
        rx="6" ry="6"
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
): string {
  const { x, y, width, height, data, selected } = node;

  const groupColor = (data as { accentColor?: string; groupColor?: string })?.accentColor ||
                    (data as { groupColor?: string })?.groupColor ||
                    (data as { color?: string })?.color ||
                    getConcernColor((data as { layer?: string; label?: string }).layer || (data as { label?: string }).label) ||
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
): string {
  const { x, y, width: W, height: H, data, selected } = node;
  const shapeData = data as ShapeNodeData;
  const shape = shapeData.shape || 'rounded-rectangle';
  const color = shapeData.accentColor ?? shapeData.color ?? getConcernColor(shapeData.layer) ?? '#0f766e';
  const sketch = renderStyleId === 'sketch';
  const surface = resolveRenderSurface({
    renderStyleId,
    isDark,
    selected: selected ?? false,
    accentColor: color,
  });
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  // Sketch titles/subtitles are warm ink (brown on paper, chalk on board) —
  // not the precision slate.
  const titleColor = sketch
    ? isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE
    : styles.titleColor;
  const subtitleColor = sketch
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
      const axis = resolveCylinderAxis(shapeData);
      if (renderStyleId === 'sketch') {
        body = renderBody(getShapePrimitives('cylinder', W, H, axis, true));  // Pass true for sketch mode
      } else if (axis === 'horizontal') {
        const inset = 2;
        const R = Math.max(8, Math.round((H - inset * 2) / 2));
        const midY = H / 2;
        const leftCx = inset + R;
        const rightCx = W - inset - R;
        const bodyW = Math.max(0, rightCx - leftCx);
        body = `
          ${bodyW > 0 ? `<rect x="${leftCx}" y="${midY - R}" width="${bodyW}" height="${R * 2}" fill="${surface.fill}" />` : ''}
          <ellipse cx="${leftCx}" cy="${midY}" rx="${R}" ry="${R}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
          <path d="M ${rightCx} ${midY - R} A ${R} ${R} 0 0 1 ${rightCx} ${midY + R}" fill="none" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
        `.trim();
      } else {
        const RY = Math.max(10, Math.round(H * 0.12));
        const rx = (W - 4) / 2;
        const cx = W / 2;
        const left = 2;
        const right = W - 2;
        const topY = RY;
        const bottomY = H - RY;
        body = `
          <rect x="${left}" y="${topY}" width="${W - 4}" height="${bottomY - topY}" fill="${surface.fill}" />
          <ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${RY}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
          <path d="M ${left} ${bottomY} A ${rx} ${RY} 0 0 0 ${right} ${bottomY}" fill="none" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
        `.trim();
      }
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
