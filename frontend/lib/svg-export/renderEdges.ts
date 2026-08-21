import type { EdgeType, PathType } from '@/data/edgeTypes';
import { getEffectivePathType } from '@/data/edgeTypes';
import { resolveEdgeStrokeDasharray } from '@/lib/utils/edgeStroke';
import { resolveEdgeVisual } from '@/lib/utils/edgeHierarchy';
import { getPointOnPath, shortenSvgPathEnd, SKETCH_ARROWHEAD_TRIM_PX } from '@/lib/utils/edgeLabelDrag';
import { getShapePrimitives } from '@/lib/theme/shapeGeometry';
import {
  getRenderStyle,
  getStrokeRenderer,
  renderSketchBodyMarkup,
  sketchEdgeInk,
  SKETCH_PAPER_TINT,
  SKETCH_PAPER_DARK,
  SKETCH_INK_DARK_TITLE,
  SKETCH_INK_LIGHT_TITLE,
  type DiagramRenderStyleId,
} from '@/lib/theme/renderStyles';
import { buildSolidArrowheadPath, escapeXml } from './svgPrimitives';
import { getPath } from './edgePaths';
import type { EdgeRenderData } from './types';

export function renderEdge(
  edge: EdgeRenderData,
  isDark: boolean,
  renderStyleId: DiagramRenderStyleId = 'precision',
): string {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, selected, isFloating } = edge;

  const isSketch = renderStyleId === 'sketch';
  const edgeType: EdgeType | undefined = data?.edgeType;
  const customPathType: PathType | undefined = data?.pathType;
  const pathType = getEffectivePathType(edgeType, customPathType);

  const visual = resolveEdgeVisual(
    data as Record<string, unknown> | undefined,
    isDark,
    isSketch,
    isSketch ? sketchEdgeInk(isDark) : undefined,
  );
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

  const rough = getStrokeRenderer('rough');
  const seed = rough.seedFor(id);

  let labelSVG = '';
  if (data?.label && !data?.hideLabel) {
    const labelText = data.label;
    // Sketch labels are warm ink — a hand-picked edge color stays (like the
    // canvas EdgeLabel); precision blends the edge color with slate.
    const customColor = data.color && /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : undefined;
    const fg = customColor
      ? customColor
      : isSketch
        ? (isDark ? SKETCH_INK_DARK_TITLE : SKETCH_INK_LIGHT_TITLE)
        : (strokeColor || (isDark ? '#CBD5E1' : '#64748b'));
    const knockout = isDark ? '#0f1117' : '#f8fafc';
    const border = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.12)';
    const sketchBorder = isDark ? 'rgba(245, 242, 235, 0.20)' : 'rgba(92, 74, 48, 0.15)';  // Lighter borders for sketch
    const paddingX = isSketch ? 4 : 6;  // Reduced padding for sketch
    const paddingY = isSketch ? 1.5 : 2;  // Reduced padding for sketch
    const charWidth = isSketch ? 4.8 : 5.4;  // Smaller char width for reduced font
    const labelWidth = Math.max(36, labelText.length * charWidth + paddingX * 2);
    const labelHeight = (isSketch ? 12 : 14) + paddingY * 2;  // Smaller height for sketch

    let labelBox = '';
    if (isSketch) {
      // Penciled label box: rough paper rectangle with quiet ink border.
      const boxBody = renderSketchBodyMarkup(
        getShapePrimitives('rounded-rectangle', labelWidth, labelHeight),
        {
          fill: isDark ? SKETCH_PAPER_DARK : SKETCH_PAPER_TINT,
          stroke: sketchBorder,  // Use lighter sketch border
          strokeWidth: 0.9,  // Reduced from 1.25 for lighter border
        },
        seed,
        isDark,
        'rounded-rectangle',
      );
      labelBox = `<g transform="translate(${-labelWidth / 2}, ${-labelHeight / 2})">${boxBody}</g>`;
    } else {
      labelBox = `
        <rect
          x="-${labelWidth / 2}"
          y="-${labelHeight / 2}"
          width="${labelWidth}"
          height="${labelHeight}"
          fill="${knockout}"
          stroke="${border}"
          stroke-width="1"
          rx="3"
        />`;
    }

    labelSVG = `
      <g transform="translate(${labelX}, ${labelY})">
        ${labelBox}
        <text
          x="0" y="3"
          fill="${fg}"
          font-family="${isSketch ? getRenderStyle('sketch').fonts.edgeLabel : 'Inter, IBM Plex Sans, system-ui, -apple-system, sans-serif'}"
          font-size="${isSketch ? 9 : 9}"
          font-weight="500"
          text-anchor="middle"
          letter-spacing="${isSketch ? '0' : '0.01em'}"
        >${escapeXml(labelText)}</text>
      </g>
    `.trim();
  }

  const sketchDrawPath = isSketch ? shortenSvgPathEnd(d, SKETCH_ARROWHEAD_TRIM_PX) : d;

  const pathSVG = isSketch
    ? rough.renderEdgePath(
        sketchDrawPath,
        { d: sketchDrawPath, stroke: strokeColor, strokeWidth, dasharray: dashArray ?? undefined, opacity },
        seed,
      )
    : `
    <path
      d="${d}"
      fill="none"
      stroke="${strokeColor}"
      stroke-width="${strokeWidth}"
      stroke-opacity="${opacity}"
      ${strokeDashAttr}
      style="opacity: ${opacity}; ${isDark ? `filter: drop-shadow(0 0 3px ${strokeColor});` : ''}"
    />`.trim();

  let arrowheadSVG = '';
  if (d) {
    try {
      const end = { x: targetX, y: targetY };
      const pathEnd = isSketch ? getPointOnPath(sketchDrawPath, 1) : getPointOnPath(d, 0.98);
      const angle = Math.atan2(end.y - pathEnd.y, end.x - pathEnd.x);
      arrowheadSVG = isSketch
        ? rough.renderArrowhead(end, angle, strokeColor, seed)
        : `<path data-edge-marker="solid-arrowhead" d="${buildSolidArrowheadPath(end, angle)}" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="0" opacity="${opacity}"/>`;
    } catch {
      // ignore — fall back to no arrowhead
    }
  }

  return `
    ${pathSVG}
    ${arrowheadSVG}
    ${labelSVG}
  `.trim();
}
