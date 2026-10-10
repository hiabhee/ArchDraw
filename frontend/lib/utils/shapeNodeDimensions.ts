import type { Node } from 'reactflow';
import { calculateNodeDimensions, type DimensionOptions } from '@/lib/utils/nodeSizing';
import { resolveCylinderAxis, type CylinderAxisInput } from '@/lib/utils/cylinderAxis';
import { SIZE_M } from '@/lib/theme/stylingConstants';
import { NODE_CONFIG } from '@/lib/config';
import { resolveNodeIconVisibility, type NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { isStudioRenderStyle } from '@/lib/theme/renderStyles';

/** Studio Minimal cards are compact; icons sit beside the title so width grows. */
export const STUDIO_COMPACT_SHAPE_WIDTH = 160;
export const STUDIO_COMPACT_SHAPE_WIDTH_WITH_ICON = 200;
/** 64px card gives the title-scale icon enough breathing room. */
export const STUDIO_COMPACT_NODE_HEIGHT = 64;
export const STUDIO_ICON_WELL_PX = 48;
export const STUDIO_ICON_GLYPH_PX = 36;
export const STUDIO_CARD_RADIUS_PX = 18;

export function studioCompactNodeSize(showIcon?: boolean): { width: number; height: number } {
  return {
    width: showIcon ? STUDIO_COMPACT_SHAPE_WIDTH_WITH_ICON : STUDIO_COMPACT_SHAPE_WIDTH,
    height: STUDIO_COMPACT_NODE_HEIGHT,
  };
}

/** Allow Studio cards to grow when a Mermaid title or detail wraps. */
export function studioContentNodeSize(
  label: string,
  subtitle?: string,
  showIcon = false,
  width = studioCompactNodeSize(showIcon).width,
): { width: number; height: number } {
  const textWidth = Math.max(56, width - (showIcon ? STUDIO_ICON_WELL_PX + 10 : 0) - 28);
  const lineCount = (text: string, averageCharacterWidth: number) =>
    text.split(/\n/).reduce((total, paragraph) => {
      let lines = 1;
      let used = 0;
      for (const word of paragraph.split(/\s+/)) {
        const wordWidth = word.length * averageCharacterWidth;
        if (used && used + averageCharacterWidth + wordWidth > textWidth) {
          lines++;
          used = 0;
        }
        used += (used ? averageCharacterWidth : 0) + wordWidth;
        if (used > textWidth) {
          lines += Math.ceil(used / textWidth) - 1;
          used %= textWidth;
        }
      }
      return total + lines;
    }, 0);
  const titleLines = lineCount(label || 'Service', 8);
  const subtitleLines = subtitle?.trim() ? lineCount(subtitle, 5.8) : 0;
  const textHeight = titleLines * 21 + subtitleLines * 14 + (subtitleLines ? 2 : 0) + 24;
  return { width, height: Math.max(STUDIO_COMPACT_NODE_HEIGHT, textHeight) };
}

function isStudioCompact(renderStyleId?: string): boolean {
  return isStudioRenderStyle(renderStyleId);
}

export interface ShapeNodeDimensionInput extends CylinderAxisInput {
  label?: string;
  sublabel?: string;
  subtitle?: string;
  shape?: string;
  nodeWidth?: number;
  nodeHeight?: number;
  showIcon?: boolean;
}

/**
 * Canonical shape-node width/height for canvas render, layout, and relayout.
 * Recomputes from label + shape so stale pipeline nodeHeight (e.g. vertical drum
 * height on a horizontal pipe) cannot break cylinder SVG geometry.
 */
export function resolveShapeNodeDimensions(
  data: ShapeNodeDimensionInput,
  renderStyleId?: string,
): {
  width: number;
  height: number;
} {
  if (isStudioCompact(renderStyleId)) {
    return studioContentNodeSize(data.label ?? '', data.sublabel ?? data.subtitle, Boolean(data.showIcon));
  }

  const shape = data.shape ?? 'rounded-rectangle';
  const cylinderAxis = shape === 'cylinder' ? resolveCylinderAxis(data) : undefined;
  const options: DimensionOptions = { shape, cylinderAxis, showIcon: data.showIcon };
  const subtitle = (data.sublabel ?? data.subtitle ?? '').trim() || undefined;
  const fitted = calculateNodeDimensions(data.label || '', subtitle, options);

  // Uniform 100px for all nodes per user request — ignore any larger stored heights.
  const width = fitted.width;
  const height = 100;

  return { width, height };
}

/** Width/height for layout, edge routing, and handles — matches ShapeNode render. */
export function getEffectiveNodeDimensions(
  node: Node,
  renderStyleId?: string,
  iconMode?: NodeIconMode,
): { width: number; height: number } {
  if (node.type === 'shapeNode') {
    const data = node.data ?? {};
    if (isStudioCompact(renderStyleId)) {
      if (iconMode) return studioContentNodeSize(String(data.label ?? ''), (data.sublabel ?? data.subtitle) as string | undefined, resolveNodeIconVisibility(iconMode, data.showIcon as boolean | undefined));
      const stored = data.nodeWidth as number | undefined;
      if (stored === STUDIO_COMPACT_SHAPE_WIDTH_WITH_ICON || stored === STUDIO_COMPACT_SHAPE_WIDTH) {
        return studioContentNodeSize(String(data.label ?? ''), (data.sublabel ?? data.subtitle) as string | undefined, stored === STUDIO_COMPACT_SHAPE_WIDTH_WITH_ICON, stored);
      }
      return studioContentNodeSize(String(data.label ?? ''), (data.sublabel ?? data.subtitle) as string | undefined, Boolean(data.showIcon));
    }
    return resolveShapeNodeDimensions({
      label: String(data.label ?? ''),
      sublabel: (data.sublabel ?? data.subtitle) as string | undefined,
      shape: data.shape as string | undefined,
      serviceType: data.serviceType as string | undefined,
      cylinderAxis: data.cylinderAxis as 'vertical' | 'horizontal' | undefined,
      nodeWidth: data.nodeWidth as number | undefined,
      nodeHeight: data.nodeHeight as number | undefined,
      showIcon: data.showIcon as boolean | undefined,
    }, renderStyleId);
  }

  const measured = node as Node & { measured?: { width?: number; height?: number } };
  const data = node.data ?? {};
  const isGroup = node.type === 'groupNode' || (data as { isGroup?: boolean })?.isGroup === true;
  if (isGroup) {
    return {
      width:
        node.width ??
        measured.measured?.width ??
        (data.nodeWidth as number | undefined) ??
        160,
      height:
        node.height ??
        measured.measured?.height ??
        (data.nodeHeight as number | undefined) ??
        100,
    };
  }
  // Annotation / free-text nodes keep their own size; SystemNode family
  // (systemNode, custom, etc.) renders at cardWidth = max(persistedWidth, fitted)
  // where fitted uses SIZE_M (200) as floor. The old fallback of 160 was smaller
  // than the rendered card (200+), causing top/bottom handles (left:50% of
  // rendered width) to be offset from edge anchors (nodeX+width/2 with width=160).
  if (node.type === 'annotation' || node.type === 'textLabel') {
    return {
      width:
        (node.width as number | undefined) ??
        measured.measured?.width ??
        (data.nodeWidth as number | undefined) ??
        160,
      height:
        (node.height as number | undefined) ??
        measured.measured?.height ??
        (data.nodeHeight as number | undefined) ??
        100,
    };
  }
  if (isStudioCompact(renderStyleId)) {
    const showIcon = iconMode
      ? resolveNodeIconVisibility(iconMode, data.showIcon as boolean | undefined)
      : Boolean(data.showIcon);
    const label = String(data.label ?? '');
    const subtitle = (data.sublabel ?? data.subtitle) as string | undefined;
    const compactWidth = studioCompactNodeSize(showIcon).width;
    const fittedWidth = calculateNodeDimensions(label, subtitle, {
      shape: 'rounded-rectangle',
      minWidth: compactWidth,
      showIcon,
    }).width;
    // Studio SystemNode renders from current content fit, not persisted layout
    // width. Dagre can leave node.width at a wider prior measurement, which
    // shifts top/bottom route anchors away from the card's actual center.
    const width = Math.max(compactWidth, fittedWidth);
    return studioContentNodeSize(label, subtitle, showIcon, width);
  }
  const labelForSizing = String((data.label as string | undefined) ?? '');
  const subtitleForSizing = ((data.sublabel ?? data.subtitle) as string | undefined)?.trim() || undefined;
  const fitted = calculateNodeDimensions(labelForSizing, subtitleForSizing, {
    shape: 'rounded-rectangle',
    minWidth: SIZE_M,
    showIcon: data.showIcon as boolean | undefined,
  });
  const storedWidth =
    (node.width as number | undefined) ??
    measured.measured?.width ??
    (data.nodeWidth as number | undefined) ??
    NODE_CONFIG.defaultWidth;
  const expectedWidth = Math.max(storedWidth, fitted.width);
  return {
    width: expectedWidth,
    height: 100,
  };
}
