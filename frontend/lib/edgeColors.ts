'use client';
import { useMemo } from 'react';
import { MarkerType } from 'reactflow';
import type { Edge } from 'reactflow';
import { useCanvasTheme } from '@/lib/theme';

const EDGE_COLORS = {
  default: '#94a3b8',
  defaultDark: '#cbd5e1',
  async: '#b45309',
  asyncDark: '#d97706',
  stream: '#10B981',
  event: '#8B5CF6',
  dep: '#6B7280',
};

/** Marker bounding box — bolder arrowheads that stay legible in dense graphs. */
export const EDGE_MARKER_SIZE = 26;

export interface EdgePalette {
  stroke: string;
  markerColor: string;
}

/**
 * Resolve a connector's palette from its semantic data.
 * - Solid sync edges form the request path → black in light mode / white in
 *   dark mode so the eye can track flow through the diagram.
 * - Async/dashed edges → amber; observability/health (control-plane) → muted.
 * - stream / event / dep keep their configured semantic colors.
 */
export function resolveEdgePalette(
  data: Record<string, unknown> | undefined,
  isDark: boolean,
): EdgePalette {
  const edgeVariant = data?.edgeVariant;
  const connectionType = data?.connectionType;
  const isAsync =
    edgeVariant === 'dashed' ||
    data?.async === true ||
    data?.syncAsync === 'async' ||
    connectionType === 'async' ||
    connectionType === 'dotted';

  if (isAsync) {
    const c = isDark ? EDGE_COLORS.asyncDark : EDGE_COLORS.async;
    return { stroke: c, markerColor: c };
  }

  // Control-plane connectors (observability, health, optional wiring) stay
  // muted so they don't compete with the request path.
  const importance = data?.importance;
  const portType = data?.portType;
  const isControl =
    importance === 'diagnostic' ||
    importance === 'optional' ||
    portType === 'observability';
  if (isControl) {
    const c = isDark ? EDGE_COLORS.defaultDark : EDGE_COLORS.default;
    return { stroke: c, markerColor: c };
  }

  if (connectionType === 'stream' || connectionType === 'event' || connectionType === 'dep') {
    const c = EDGE_COLORS[connectionType];
    return { stroke: c, markerColor: c };
  }

  const c = isDark ? '#ffffff' : '#000000';
  return { stroke: c, markerColor: c };
}

export function useEdgeColors(edges: Edge[]): Edge[] {
  const { isDark } = useCanvasTheme();

  return useMemo(() => {
    return edges.map((edge) => {
      const { stroke, markerColor } = resolveEdgePalette(
        edge.data as Record<string, unknown> | undefined,
        isDark,
      );
      return {
        ...edge,
        style: { ...edge.style, stroke, strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: EDGE_MARKER_SIZE,
          height: EDGE_MARKER_SIZE,
        },
        labelStyle: { ...edge.labelStyle, fill: stroke },
      };
    });
  }, [edges, isDark]);
}

export function assignEdgeColors(edges: Edge[], isDark: boolean = true): Edge[] {
  const defaultColor = isDark ? EDGE_COLORS.defaultDark : EDGE_COLORS.default;
  return edges.map((edge) => ({
    ...edge,
    style: { ...edge.style, stroke: defaultColor, strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: defaultColor,
      width: EDGE_MARKER_SIZE,
      height: EDGE_MARKER_SIZE,
    },
    labelStyle: { ...edge.labelStyle, fill: defaultColor },
  }));
}
