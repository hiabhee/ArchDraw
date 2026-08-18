'use client';
import { useMemo } from 'react';
import { MarkerType } from 'reactflow';
import type { Edge } from 'reactflow';
import { useDiagramAesthetics } from '@/lib/theme/useDiagramAesthetics';
import { resolveEdgeVisual } from '@/lib/utils/edgeHierarchy';
import type { SketchEdgeInk } from '@/lib/theme/renderStyles';

/** Marker bounding box — bolder arrowheads that stay legible in dense graphs. */
export const EDGE_MARKER_SIZE = 26;

export interface EdgePalette {
  stroke: string;
  markerColor: string;
  strokeWidth?: number;
  opacity?: number;
  isPrimary?: boolean;
}

/**
 * Resolve a connector's palette from its semantic data.
 * Primary/spine edges form the request path; secondary sync stays muted;
 * async/dashed → amber; observability/health (control-plane) → quieter still.
 * In sketch the structural inks come from the resolved sketch palette
 * (`aesthetics.colors.*` → `ink`) so edges read as warm hand-ink, not UI.
 */
export function resolveEdgePalette(
  data: Record<string, unknown> | undefined,
  isDark: boolean,
  sketch = false,
  ink?: Partial<SketchEdgeInk>,
): EdgePalette {
  const visual = resolveEdgeVisual(data, isDark, sketch, ink);
  return {
    stroke: visual.stroke,
    markerColor: visual.markerColor,
    strokeWidth: visual.strokeWidth,
    opacity: visual.opacity,
    isPrimary: visual.isPrimary,
  };
}

export function useEdgeColors(edges: Edge[]): Edge[] {
  const { isDark, renderStyleId, colors } = useDiagramAesthetics();
  const sketch = renderStyleId === 'sketch';

  return useMemo(() => {
    return edges.map((edge) => {
      const palette = resolveEdgePalette(
        edge.data as Record<string, unknown> | undefined,
        isDark,
        sketch,
        sketch
          ? { primary: colors.edgePrimary, default: colors.edgeDefault, async: colors.edgeAsync }
          : undefined,
      );
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: palette.stroke,
          strokeWidth: palette.strokeWidth ?? 1.25,
          opacity: palette.opacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: palette.markerColor,
          width: EDGE_MARKER_SIZE,
          height: EDGE_MARKER_SIZE,
        },
        labelStyle: { ...edge.labelStyle, fill: palette.stroke },
      };
    });
  }, [edges, isDark, sketch, colors.edgePrimary, colors.edgeDefault, colors.edgeAsync]);
}

export function assignEdgeColors(
  edges: Edge[],
  isDark: boolean = true,
  sketch = false,
  ink?: Partial<SketchEdgeInk>,
): Edge[] {
  return edges.map((edge) => {
    const palette = resolveEdgePalette(
      edge.data as Record<string, unknown> | undefined,
      isDark,
      sketch,
      ink,
    );
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: palette.stroke,
        strokeWidth: palette.strokeWidth ?? 1.25,
        opacity: palette.opacity,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: palette.markerColor,
        width: EDGE_MARKER_SIZE,
        height: EDGE_MARKER_SIZE,
      },
      labelStyle: { ...edge.labelStyle, fill: palette.stroke },
    };
  });
}
