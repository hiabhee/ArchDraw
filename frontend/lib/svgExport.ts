import { Node, Edge, getSmoothStepPath, getBezierPath, getStraightPath, Position } from 'reactflow';
import type { NodeData } from '@/store/diagram/types';
import { getEffectivePathType, type EdgeData, type EdgeType, type PathType } from '@/data/edgeTypes';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  STATUS_COLORS,
  getConcernColor,
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
  STROKE_WIDTH,
  BORDER_RADIUS,
} from '@/lib/theme/stylingConstants';
import { computeEdgeRoute, type EdgeRouteDirection } from '@/lib/utils/edgeRouteBuilder';
import { buildSmoothStepSvg } from '@/lib/utils/collisionFreeEdgePath';
import { getPointOnPath } from '@/lib/utils/edgeLabelDrag';
import { resolveEdgeStrokeDasharray } from '@/lib/utils/edgeStroke';
import { resolveEdgeVisual } from '@/lib/utils/edgeHierarchy';
import { computeEdgeLabelLayout } from '@/lib/utils/edgeLabelLayout';
import { resolveCylinderAxis } from '@/lib/utils/cylinderAxis';
import { semanticShapeBodySvg } from '@/lib/utils/shapeSilhouetteSvg';
import { resolveTextLabelColor } from '@/lib/utils/textSizing';

interface TextLabelNodeData extends NodeData {
  text?: string;
  fontSize?: string;
  bold?: boolean;
}

interface AnnotationNodeData extends NodeData {
  title?: string;
  body?: string;
  titleSize?: string;
  titleBold?: boolean;
  bodySize?: string;
  bodyBold?: boolean;
}

interface EdgeDataExtended extends EdgeData {
  animated?: boolean;
  isBidirectional?: boolean;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface SystemNodeRenderData {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: NodeData;
  selected?: boolean;
}

interface ShapeNodeData extends NodeData {
  shape?: string;
  sublabel?: string;
  accentColor?: string;
  serviceType?: string;
  cylinderAxis?: 'vertical' | 'horizontal';
}

interface EdgeRenderData {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data: EdgeData | undefined;
  style?: Edge['style'];
  selected?: boolean;
  isFloating?: boolean;
  svgPath?: string;
  labelX?: number;
  labelY?: number;
}

function resolveAbsolutePosition(node: Node, nodeMap: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentNode;
  while (parentId) {
    const parent = nodeMap.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentNode;
  }
  return { x, y };
}

function nodeDepth(node: Node, nodeMap: Map<string, Node>): number {
  let depth = 0;
  let parentId = node.parentNode;
  while (parentId && nodeMap.has(parentId)) {
    depth += 1;
    parentId = nodeMap.get(parentId)!.parentNode;
  }
  return depth;
}

function resolveShapeSurfaceSvg(
  isDark: boolean,
  selected: boolean,
  accentColor: string,
): { fill: string; stroke: string; strokeWidth: number } {
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const fill = isDark ? styles.background : '#ffffff';
  const stroke = selected
    ? accentColor
    : isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(15, 23, 42, 0.14)';
  const strokeWidth = selected ? 2 : 1.25;
  return { fill, stroke, strokeWidth };
}

function getTierColorNormalized(layer?: string): string {
  return getConcernColor(layer);
}

function getDarkCategoryStyle(layer?: string): { border: string; glow: string } {
  const color = getTierColorNormalized(layer);
  return { border: color, glow: hexToRgba(color, 0.12) };
}

function getBezierPathWithOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
): { path: string; labelX: number; labelY: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const curveStrength = Math.min(Math.abs(dx) * 0.5, 80);

  let controlOffset1: { x: number; y: number };
  let controlOffset2: { x: number; y: number };

  if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
    controlOffset1 = { x: sourceX + Math.sign(dx) * curveStrength, y: sourceY };
    controlOffset2 = { x: targetX - Math.sign(dx) * curveStrength, y: targetY };
  } else {
    controlOffset1 = { x: sourceX, y: sourceY + Math.sign(dy) * curveStrength };
    controlOffset2 = { x: targetX, y: targetY - Math.sign(dy) * curveStrength };
  }

  const path = `M ${sourceX} ${sourceY} C ${controlOffset1.x} ${controlOffset1.y}, ${controlOffset2.x} ${controlOffset2.y}, ${targetX} ${targetY}`;

  return {
    path,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2,
  };
}

function getPath(
  pathType: PathType,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  isFloating?: boolean
): { path: string; labelX: number; labelY: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minCurveDistance = 100;

  const normalizedPathType = (pathType || 'Smoothstep').toLowerCase();

  if (isFloating) {
    if (normalizedPathType === 'straight') {
      const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      return { path, labelX, labelY };
    }
    if (normalizedPathType === 'bezier') {
      const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
      return { path, labelX, labelY };
    }
    // Default: smoothstep/smooth
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 50,
    });
    return { path, labelX, labelY };
  }

  // Non-floating (static) edge path logic
  if (normalizedPathType === 'bezier') {
    if (distance < minCurveDistance) {
      const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      return { path, labelX, labelY };
    }
    return getBezierPathWithOffset(sourceX, sourceY, targetX, targetY, sourcePosition);
  }

  if (normalizedPathType === 'smooth') {
    if (distance < minCurveDistance) {
      const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      return { path, labelX, labelY };
    }
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 24,
    });
    return { path, labelX, labelY };
  }

  if (normalizedPathType === 'smoothstep' || normalizedPathType === 'step') {
    if (distance < minCurveDistance) {
      const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      return { path, labelX, labelY };
    }
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 50,
    });
    return { path, labelX, labelY };
  }

  // straight / default
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return { path, labelX, labelY };
}

function renderSystemNode(node: SystemNodeRenderData, isDark: boolean): string {
  const { x, y, width, height, data, selected } = node;
  
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
          font-size="13.5"
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

function renderTextLabel(node: SystemNodeRenderData, isDark: boolean): string {
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

function renderAnnotationNode(node: SystemNodeRenderData, isDark: boolean): string {
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

function renderGroupNode(node: SystemNodeRenderData, isDark: boolean): string {
  const { x, y, width, height, data, selected } = node;
  
  const groupColor = (data as { accentColor?: string; groupColor?: string })?.accentColor || 
                    (data as { groupColor?: string })?.groupColor || 
                    (data as { color?: string })?.color ||
                    getConcernColor((data as { layer?: string; label?: string }).layer || (data as { label?: string }).label) ||
                    '#0f766e';
  
  const bgRgba = hexToRgba(groupColor, isDark ? 0.09 : 0.05);
  const borderColor = isDark
    ? selected
      ? hexToRgba(groupColor, 0.65)
      : hexToRgba(groupColor, 0.38)
    : selected
      ? hexToRgba(groupColor, 0.6)
      : hexToRgba(groupColor, 0.32);

  const borderWidth = selected ? 1.5 : 1;

  const label = (data as { groupLabel?: string; label?: string })?.groupLabel ||
               (data as { label?: string })?.label || '';

  const tagText = isDark ? hexToRgba(groupColor, 0.9) : groupColor;
  
  return `
    <g transform="translate(${x}, ${y})">
      <rect
        x="0" y="0"
        width="${width}" height="${height}"
        fill="${bgRgba}"
        stroke="${borderColor}"
        stroke-width="${borderWidth}"
        rx="12" ry="12"
      />
      ${label ? `
      <text
        x="12" y="18"
        fill="${tagText}"
        font-family="Inter, Roboto, system-ui, -apple-system, sans-serif"
        font-size="11"
        font-weight="500"
        letter-spacing="0.04em"
      >${escapeXml(label)}</text>` : ''}
    </g>
  `.trim();
}

function renderShapeNode(node: SystemNodeRenderData, isDark: boolean): string {
  const { x, y, width: W, height: H, data, selected } = node;
  const shapeData = data as ShapeNodeData;
  const shape = shapeData.shape || 'rounded-rectangle';
  const color = shapeData.accentColor ?? shapeData.color ?? getConcernColor(shapeData.layer) ?? '#0f766e';
  const surface = resolveShapeSurfaceSvg(isDark, selected ?? false, color);
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const titleColor = styles.titleColor;
  const subtitleColor = styles.subtitleColor;
  const title = shapeData.label || '';
  const subtitle = shapeData.sublabel;

  let body = '';
  switch (shape) {
    case 'diamond': {
      const pts = `${W / 2},4 ${W - 4},${H / 2} ${W / 2},${H - 4} 4,${H / 2}`;
      body = `<polygon points="${pts}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />`;
      break;
    }
    case 'circle': {
      body = `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - 2}" ry="${H / 2 - 2}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />`;
      break;
    }
    case 'parallelogram': {
      const skew = Math.min(16, Math.round(W * 0.08));
      const pts = `${skew},4 ${W - 4},4 ${W - skew - 4},${H - 4} 4,${H - 4}`;
      body = `<polygon points="${pts}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />`;
      break;
    }
    case 'cylinder': {
      const axis = resolveCylinderAxis(shapeData);
      if (axis === 'horizontal') {
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
      const semantic = semanticShapeBodySvg(shape, W, H, surface, isDark);
      if (semantic) {
        body = semantic;
        break;
      }
      const rounded = shape === 'rounded-rectangle';
      const r = rounded ? 10 : 6;
      body = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}" ry="${r}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />`;
      break;
    }
  }

  const titleY = subtitle ? H / 2 - 4 : H / 2 + 4;
  const subtitleY = H / 2 + 12;

  return `
    <g transform="translate(${x}, ${y})">
      ${body}
      ${title ? `
      <text
        x="${W / 2}" y="${titleY}"
        fill="${titleColor}"
        font-family="Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif"
        font-size="13.5"
        font-weight="600"
        text-anchor="middle"
        letter-spacing="-0.015em"
      >${escapeXml(title)}</text>` : ''}
      ${subtitle ? `
      <text
        x="${W / 2}" y="${subtitleY}"
        fill="${subtitleColor}"
        font-family="Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif"
        font-size="10.5"
        font-weight="400"
        text-anchor="middle"
      >${escapeXml(subtitle)}</text>` : ''}
    </g>
  `.trim();
}

function renderEdge(edge: EdgeRenderData, isDark: boolean): string {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, selected, isFloating } = edge;
  
  const edgeType: EdgeType | undefined = data?.edgeType;
  const customPathType: PathType | undefined = data?.pathType;
  const pathType = getEffectivePathType(edgeType, customPathType);

  const visual = resolveEdgeVisual(data as Record<string, unknown> | undefined, isDark);
  let strokeColor = data?.color || visual.stroke;
  if (selected) {
    strokeColor = isDark ? '#e2e8f0' : '#1e293b';
  }

  let strokeWidth = selected ? visual.strokeWidth + 0.75 : visual.strokeWidth;
  const edgeVariant = data?.edgeVariant;

  if (edgeVariant === 'feedback') {
    strokeWidth = selected ? 3 : 2;
  }

  const dashArray = resolveEdgeStrokeDasharray(data as Record<string, unknown> | undefined, style);
  const strokeDashAttr = dashArray ? `stroke-dasharray="${dashArray}"` : '';
  const opacity = selected ? 1 : visual.opacity;
  
  let d = edge.svgPath;
  let labelX = edge.labelX ?? (sourceX + targetX) / 2;
  let labelY = edge.labelY ?? (sourceY + targetY) / 2;

  if (!d) {
    const pathResult = getPath(pathType, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isFloating);
    d = pathResult.path;
    if (edge.labelX === undefined) {
      labelX = pathResult.labelX;
      labelY = pathResult.labelY;
    }
  } else if (edge.labelX === undefined) {
    try {
      const labelPos = getPointOnPath(d, 0.5);
      labelX = labelPos.x;
      labelY = labelPos.y;
    } catch {
      // Fallback
    }
  }
  
  const isBidirectional = (data as EdgeDataExtended)?.isBidirectional;

  const markerEndId = `arrow-${id}`;
  const markerStartId = `arrow-start-${id}`;
  
  let defsSVG = `<defs>
    <marker id="${markerEndId}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${strokeColor}"/>
    </marker>`;
    
  if (isBidirectional) {
    defsSVG += `
    <marker id="${markerStartId}" markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="${strokeColor}"/>
    </marker>`;
  }
  defsSVG += '\n  </defs>';

  const markerEndAttr = `marker-end="url(#${markerEndId})"`;
  const markerStartAttr = isBidirectional ? `marker-start="url(#${markerStartId})"` : '';
  
  let labelSVG = '';
  if (data?.label && !data?.hideLabel) {
    const labelText = data.label;
    const fg = strokeColor || (isDark ? '#CBD5E1' : '#64748b');
    const knockout = isDark ? '#0f1117' : '#f8fafc';
    const border = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.12)';
    const paddingX = 6;
    const paddingY = 2;
    const charWidth = 5.4;
    const labelWidth = Math.max(36, labelText.length * charWidth + paddingX * 2);
    const labelHeight = 14 + paddingY * 2;

    labelSVG = `
      <g transform="translate(${labelX}, ${labelY})">
        <rect
          x="-${labelWidth / 2}"
          y="-${labelHeight / 2}"
          width="${labelWidth}"
          height="${labelHeight}"
          fill="${knockout}"
          stroke="${border}"
          stroke-width="1"
          rx="3"
        />
        <text
          x="0" y="3"
          fill="${fg}"
          font-family="Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif"
          font-size="9"
          font-weight="500"
          text-anchor="middle"
          letter-spacing="0.01em"
        >${escapeXml(labelText)}</text>
      </g>
    `.trim();
  }
  
  return `
    ${defsSVG}
    <path
      d="${d}"
      fill="none"
      stroke="${strokeColor}"
      stroke-width="${strokeWidth}"
      stroke-opacity="${opacity}"
      ${strokeDashAttr}
      ${markerEndAttr}
      ${markerStartAttr}
      style="opacity: ${opacity}; ${isDark ? `filter: drop-shadow(0 0 3px ${strokeColor});` : ''}"
    />
    ${labelSVG}
  `.trim();
}

function calculateBounds(nodes: Node[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.width ?? node.data?.nodeWidth ?? NODE_WIDTH;
    const height = node.height ?? node.data?.nodeHeight ?? NODE_HEIGHT;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width + 20);
    maxY = Math.max(maxY, node.position.y + height + 20);
  }

  const padding = 50;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

export function generatePureSVG(
  nodes: Node[],
  edges: Edge[],
  isDark: boolean = true,
  backgroundColor: string = '#0f172a',
  layoutDirection: EdgeRouteDirection = 'LR',
): string {
  const rawNodeMap = new Map(nodes.map((n) => [n.id, n]));

  const preparedNodes = nodes.map((node) => {
    const measuredWidth = (node as Node & { measured?: { width?: number } }).measured?.width;
    const measuredHeight = (node as Node & { measured?: { height?: number } }).measured?.height;

    let w = node.width ?? node.data?.nodeWidth ?? measuredWidth ?? NODE_WIDTH;
    let h = node.height ?? node.data?.nodeHeight ?? measuredHeight ?? NODE_HEIGHT;

    if (node.type === 'textLabelNode') {
      w = w || 120;
      h = h || 40;
    } else if (node.type === 'annotationNode') {
      w = w || 200;
      h = h || 120;
    } else if (node.type === 'groupNode' || node.type === 'group') {
      w = w || 300;
      h = h || 200;
    } else {
      w = measuredWidth || w || 160;
      h = measuredHeight || h || 80;
    }

    const abs = resolveAbsolutePosition(node, rawNodeMap);

    return {
      ...node,
      width: w,
      height: h,
      position: abs,
    };
  });

  const nodeMap = new Map(preparedNodes.map((n) => [n.id, n]));
  const sortedNodes = [...preparedNodes].sort(
    (a, b) => nodeDepth(a, nodeMap) - nodeDepth(b, nodeMap),
  );

  const bounds = calculateBounds(preparedNodes);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  const nodeElements: string[] = [];
  const edgeElements: string[] = [];

  for (const node of sortedNodes) {
    const nodeData: SystemNodeRenderData = {
      id: node.id,
      type: node.type || 'systemNode',
      x: node.position.x - bounds.minX,
      y: node.position.y - bounds.minY,
      width: node.width!,
      height: node.height!,
      data: node.data as NodeData,
      selected: node.selected,
    };

    if (node.type === 'textLabelNode') {
      nodeElements.push(renderTextLabel(nodeData, isDark));
    } else if (node.type === 'annotationNode') {
      nodeElements.push(renderAnnotationNode(nodeData, isDark));
    } else if (node.type === 'groupNode' || node.type === 'group') {
      nodeElements.push(renderGroupNode(nodeData, isDark));
    } else if (node.type === 'shapeNode') {
      nodeElements.push(renderShapeNode(nodeData, isDark));
    } else {
      nodeElements.push(renderSystemNode(nodeData, isDark));
    }
  }

  const processedEdges: Edge[] = [];
  const processedEdgeIds = new Set<string>();

  for (const edge of edges) {
    if (processedEdgeIds.has(edge.id)) continue;

    const source = edge.source;
    const target = edge.target;

    const forward = edges.filter((e) => e.source === source && e.target === target);
    const reverse = edges.filter((e) => e.source === target && e.target === source);
    const isBidirectional = forward.length > 0 && reverse.length > 0;

    if (isBidirectional) {
      const group = [...forward, ...reverse].sort((a, b) => a.id.localeCompare(b.id));
      const leader = group[0];

      for (const e of group) {
        processedEdgeIds.add(e.id);
      }

      const combinedLabel = group
        .map((e) => e.data?.label?.trim())
        .filter(Boolean)
        .join(' / ');

      processedEdges.push({
        ...leader,
        data: {
          ...leader.data,
          label: combinedLabel || undefined,
          isBidirectional: true,
        },
      });
    } else {
      processedEdgeIds.add(edge.id);
      processedEdges.push(edge);
    }
  }

  const nodeInternals = new Map(preparedNodes.map((n) => [n.id, n]));
  const labelLayouts = computeEdgeLabelLayout(processedEdges, nodeInternals, layoutDirection);

  for (const edge of processedEdges) {
    const sourceNode = preparedNodes.find((n) => n.id === edge.source);
    const targetNode = preparedNodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    const route = computeEdgeRoute(edge, preparedNodes, processedEdges, layoutDirection);

    const sourceX = route.sourcePoint.x - bounds.minX;
    const sourceY = route.sourcePoint.y - bounds.minY;
    const targetX = route.targetPoint.x - bounds.minX;
    const targetY = route.targetPoint.y - bounds.minY;
    const sourcePos = route.sourcePosition;
    const targetPos = route.targetPosition;
    const isFloating = edge.type === 'simpleFloating' || (!edge.sourceHandle && !edge.targetHandle);

    const translatedWaypoints = route.waypoints.map((pt) => ({
      x: pt.x - bounds.minX,
      y: pt.y - bounds.minY,
    }));

    const isStep = edge.data?.pathType === 'step';
    const borderRadius = isStep ? 0 : 40;

    let svgPath = '';
    if (edge.source === edge.target) {
      const r = 40;
      svgPath = `M ${sourceX},${sourceY} C ${sourceX},${sourceY - r} ${targetX + r},${targetY} ${targetX},${targetY}`;
    } else if (translatedWaypoints.length > 0) {
      svgPath = buildSmoothStepSvg(translatedWaypoints, borderRadius);
    }

    const labelAnchor = labelLayouts.get(edge.id);
    const labelX = labelAnchor ? labelAnchor.x - bounds.minX : undefined;
    const labelY = labelAnchor ? labelAnchor.y - bounds.minY : undefined;

    const edgeData: EdgeRenderData = {
      id: edge.id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: sourcePos,
      targetPosition: targetPos,
      data: edge.data as EdgeData | undefined,
      style: edge.style,
      selected: edge.selected,
      isFloating,
      svgPath: svgPath || undefined,
      labelX,
      labelY,
    };

    edgeElements.push(renderEdge(edgeData, isDark));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${backgroundColor === 'none' ? '' : `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}"/>`}
  <g id="edges">
${edgeElements.map((e) => '    ' + e.replace(/\n/g, '\n    ')).join('\n')}
  </g>
  <g id="nodes">
${nodeElements.map((n) => '    ' + n.replace(/\n/g, '\n    ')).join('\n')}
  </g>
</svg>`.trim();
}

