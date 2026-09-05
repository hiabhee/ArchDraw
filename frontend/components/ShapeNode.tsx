'use client';

import { memo, useLayoutEffect, useRef } from 'react';
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
  Queue,
  Cache,
  FunctionShape,
  Container,
  Bucket,
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
  // Guard against React Flow's measured node.width/node.height (floats from
  // getBoundingClientRect / subpixel + border box-sizing) never exactly
  // equaling our integer-computed width/height. Comparing stored node.width
  // vs the computed width ping-pongs forever (RF re-measures, reports a float
  // dimension change, applyNodeChanges overwrites node.width, effect refires →
  // "Maximum update depth exceeded"). Compare against our OWN persisted
  // data.nodeWidth/nodeHeight integers instead, which settle exactly once we
  // write them.
  const storedNodeWidth = useDiagramStore((s) => {
    const n = s.nodes.find((nd) => nd.id === id);
    return (n?.data as { nodeWidth?: number } | undefined)?.nodeWidth;
  });
  const storedNodeHeight = useDiagramStore((s) => {
    const n = s.nodes.find((nd) => nd.id === id);
    return (n?.data as { nodeHeight?: number } | undefined)?.nodeHeight;
  });

  // Guard against synchronous update loops: width/height are derived from data,
  // and updateNodeSize writes back to data. Without a ref guard, a float vs int
  // mismatch (React Flow measured vs grid-snapped) or a stale closure can cause
  // useLayoutEffect to fire every commit and hit "Maximum update depth exceeded".
  // Track the last size we pushed to the store and only push when it truly changes.
  const lastPushedSizeRef = useRef<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (storedNodeWidth === width && storedNodeHeight === height) {
      lastPushedSizeRef.current = { w: width, h: height };
      return;
    }
    if (
      lastPushedSizeRef.current &&
      lastPushedSizeRef.current.w === width &&
      lastPushedSizeRef.current.h === height
    ) {
      return;
    }
    lastPushedSizeRef.current = { w: width, h: height };
    // Defer store write to next microtask so React Flow's internal
    // commit finishes before we trigger a Zustand set(). This breaks the
    // synchronous loop: effect -> set -> render -> effect -> set ...
    queueMicrotask(() => {
      // Re-check after defer — another effect may have already synced.
      const cur = useDiagramStore.getState().nodes.find((nd) => nd.id === id);
      const curW = (cur?.data as { nodeWidth?: number } | undefined)?.nodeWidth;
      const curH = (cur?.data as { nodeHeight?: number } | undefined)?.nodeHeight;
      if (curW === width && curH === height) return;
      updateNodeSize(id, { width, height });
    });
  }, [id, width, height, storedNodeWidth, storedNodeHeight, updateNodeSize]);

  // updateNodeInternals is a React Flow imperative handle; calling it
  // synchronously on every size change can trigger onNodesChange -> set
  // -> effect loop. Defer and coalesce.
  const pendingInternalsRef = useRef(false);
  useLayoutEffect(() => {
    if (pendingInternalsRef.current) return;
    pendingInternalsRef.current = true;
    queueMicrotask(() => {
      pendingInternalsRef.current = false;
      updateNodeInternals(id);
    });
  }, [id, width, height, updateNodeInternals]);

  const shellProps = {
    id,
    data,
    selected: !!selected,
    backplates,
    isDark,
    styles,
    sketch: renderStyleId === 'sketch',
    brutal: renderStyleId === 'neubrutalism',
    ...sized,
  };

  const renderShape = () => {
    switch (data.shape) {
      case 'diamond':          return <Diamond {...shellProps} />;
      case 'cylinder': {
        // Legacy horizontal cylinder (pipe) vs vertical drum — check axis
        const axis = (data as { cylinderAxis?: string }).cylinderAxis;
        if (axis === 'horizontal') return <HorizontalPipeCylinder {...shellProps} />;
        return <Cylinder {...shellProps} />;
      }
      case 'queue':            return <Queue {...shellProps} />;
      case 'cache':            return <Cache {...shellProps} />;
      case 'function':         return <FunctionShape {...shellProps} />;
      case 'container':        return <Container {...shellProps} />;
      case 'bucket':           return <Bucket {...shellProps} />;
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
