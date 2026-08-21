import type { Node } from 'reactflow';
import { calculateNodeDimensions, type DimensionOptions } from '@/lib/utils/nodeSizing';
import { resolveCylinderAxis, type CylinderAxisInput } from '@/lib/utils/cylinderAxis';

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
export function resolveShapeNodeDimensions(data: ShapeNodeDimensionInput): {
  width: number;
  height: number;
} {
  const shape = data.shape ?? 'rounded-rectangle';
  const cylinderAxis = shape === 'cylinder' ? resolveCylinderAxis(data) : undefined;
  const options: DimensionOptions = { shape, cylinderAxis, showIcon: data.showIcon };
  const subtitle = (data.sublabel ?? data.subtitle ?? '').trim() || undefined;
  const fitted = calculateNodeDimensions(data.label || '', subtitle, options);

  // Some shapes have axis-specific sizing — ignore stale stored dimensions.
  const ignoreStored = shape === 'document' || shape === 'documents' || shape === 'cylinder' || shape === 'queue';
  const width = ignoreStored ? fitted.width : Math.max(data.nodeWidth ?? 0, fitted.width);
  // Cylinder/queue height is axis-specific — never inherit a mismatched nodeHeight.
  const height =
    ignoreStored
      ? fitted.height
      : Math.max(data.nodeHeight ?? 0, fitted.height);

  return { width, height };
}

/** Width/height for layout, edge routing, and handles — matches ShapeNode render. */
export function getEffectiveNodeDimensions(node: Node): { width: number; height: number } {
  if (node.type === 'shapeNode') {
    const data = node.data ?? {};
    return resolveShapeNodeDimensions({
      label: String(data.label ?? ''),
      sublabel: (data.sublabel ?? data.subtitle) as string | undefined,
      shape: data.shape as string | undefined,
      serviceType: data.serviceType as string | undefined,
      cylinderAxis: data.cylinderAxis as 'vertical' | 'horizontal' | undefined,
      nodeWidth: data.nodeWidth as number | undefined,
      nodeHeight: data.nodeHeight as number | undefined,
      showIcon: data.showIcon as boolean | undefined,
    });
  }

  const measured = node as Node & { measured?: { width?: number; height?: number } };
  const data = node.data ?? {};
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
      80,
  };
}
