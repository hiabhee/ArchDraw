'use client';

import { memo, useLayoutEffect } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';
import {
  LIGHT_NODE_STYLES,
  DARK_NODE_STYLES,
} from '@/lib/theme/stylingConstants';
import { resolveShapeNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import { getShapeLabelMaxWidth } from '@/lib/utils/shapeTextLayout';
import { useDiagramStore } from '@/store/diagramStore';
import { resolveNodeIconVisibility } from '@/lib/utils/nodeIconVisibility';
import { type ShapeType } from '@/lib/shapeRegistry';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import './nodes/nodeStyles.css';
import type { ShapeNodeData } from './nodes/shapes/types';
import { resolveShapeLabelLayout, type ShapeLabelLayout } from './nodes/shapes/labelLayout';
import { Rectangle, Diamond, Circle, Parallelogram } from './nodes/shapes/basicShapes';
import { Cylinder, HorizontalPipeCylinder } from './nodes/shapes/cylinders';
import {
  Hexagon,
  Cloud,
  Actor,
  Monitor,
  Mobile,
  DashedRectangle,
  Document,
  Documents,
} from './nodes/shapes/silhouettes';

export type { ShapeType };
export type { ShapeNodeData, ShapeLabelLayout };
export { resolveShapeLabelLayout };

/** Fit to optical grid; wrap long labels inside the silhouette mid-band. */
function resolveShapeSize(data: ShapeNodeData, showIcon?: boolean): { width: number; height: number; labelMaxWidth: number } {
  const { width, height } = resolveShapeNodeDimensions({ ...data, showIcon });
  return {
    width,
    height,
    labelMaxWidth: getShapeLabelMaxWidth(data.shape, width, 'title'),
  };
}

// ── Main component ────────────────────────────────────────────────────────────

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const { isDark } = useCanvasTheme();
  const { renderStyleId } = useDiagramAesthetics();
  const styles = isDark ? DARK_NODE_STYLES : LIGHT_NODE_STYLES;
  const backplates = styles.backplates;
  const iconMode = useDiagramStore((s) => s.iconMode);
  // Resolve icon visibility for dynamic sizing — nodes shrink when icons are off.
  const nodeShowIcon = resolveNodeIconVisibility(iconMode, data.showIcon, false);
  const { width, height, labelMaxWidth } = resolveShapeSize(data, nodeShowIcon);
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
      case 'rounded-rectangle':
      case 'rectangle':         return <Rectangle {...shellProps} rounded />;
      default:                 return <Rectangle {...shellProps} rounded />;
    }
  };

  return renderShape();
}

export const ShapeNode = memo(ShapeNodeComponent);
