'use client';
import { useMemo } from 'react';
import { MarkerType } from 'reactflow';
import type { Edge } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';
import { resolveEdgeVisual } from '@/lib/utils/edgeHierarchy';

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
 */
export function resolveEdgePalette(
  data: Record<string, unknown> | undefined,
  isDark: boolean,
): EdgePalette {
  const visual = resolveEdgeVisual(data, isDark);
  return {
    stroke: visual.stroke,
    markerColor: visual.markerColor,
    strokeWidth: visual.strokeWidth,
    opacity: visual.opacity,
    isPrimary: visual.isPrimary,
  };
}

export function useEdgeColors(edges: Edge[]): Edge[] {
  const { isDark } = useCanvasTheme();

  return useMemo(() => {
    return edges.map((edge) => {
      const palette = resolveEdgePalette(
        edge.data as Record<string, unknown> | undefined,
        isDark,
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
  }, [edges, isDark]);
}

export function assignEdgeColors(edges: Edge[], isDark: boolean = true): Edge[] {
  return edges.map((edge) => {
    const palette = resolveEdgePalette(
      edge.data as Record<string, unknown> | undefined,
      isDark,
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
