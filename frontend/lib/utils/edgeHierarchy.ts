/**
 * Primary-vs-secondary edge hierarchy for canvas + SVG export.
 * Spine / importance metadata comes from clarityCompiler + edgeClassifier.
 */

import { EDGE_CONFIG } from '@/lib/config';
import { EDGE_STYLES, FLOW_ACCENT } from '@/lib/theme/stylingConstants';
import { sketchEdgeInk, type SketchEdgeInk } from '@/lib/theme/renderStyles';
import { isAsyncEdge } from '@/lib/utils/edgeStroke';

export interface EdgeVisual {
  stroke: string;
  markerColor: string;
  strokeWidth: number;
  opacity: number;
  isPrimary: boolean;
}

const MUTED = {
  light: '#000000',
  dark: '#ffffff',
  supportingLight: '#000000',
  supportingDark: '#ffffff',
  asyncLight: '#000000',
  asyncDark: '#ffffff',
} as const;

/** Request-path / spine edges that should read as the primary flow. */
export function isPrimaryEdge(data?: Record<string, unknown> | null): boolean {
  if (!data) return true;
  if (data.isSpine === true) return true;
  if (data.importance === 'primary') return true;
  if (data.edgeVariant === 'thick') return true;
  // Explicit demotion from clarity / classifiers
  if (
    data.importance === 'secondary' ||
    data.importance === 'supporting' ||
    data.importance === 'diagnostic' ||
    data.importance === 'optional' ||
    data.isSpine === false
  ) {
    return false;
  }
  // Unclassified legacy edges keep request-path weight
  return true;
}

function isControlPlane(data?: Record<string, unknown> | null): boolean {
  if (!data) return false;
  const importance = data.importance;
  return (
    importance === 'diagnostic' ||
    importance === 'optional' ||
    data.portType === 'observability'
  );
}

/**
 * Resolve stroke / weight / opacity from semantic edge data.
 * Primary spine → high-contrast flow accent; secondary sync → muted; async → amber.
 * `sketch` routes structural ink through the warm sketch palette
 * (`aesthetics.colors.edgePrimary / edgeDefault / …` or the sketch.ts defaults)
 * so penciled edges read like hand ink, not UI strokes.
 */
export function resolveEdgeVisual(
  data: Record<string, unknown> | undefined,
  isDark: boolean,
  sketch = false,
  ink?: Partial<SketchEdgeInk>,
): EdgeVisual {
  const async = isAsyncEdge(data);
  const primary = !async && isPrimaryEdge(data);
  const control = isControlPlane(data);
  const importance = typeof data?.importance === 'string' ? data.importance : 'secondary';
  const connectionType = String(data?.connectionType || '').toLowerCase();
  const palette = sketch ? { ...sketchEdgeInk(isDark), ...ink } : undefined;

  if (async) {
    const c = palette ? palette.async : isDark ? MUTED.asyncDark : MUTED.asyncLight;
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: EDGE_STYLES.async.width,
      opacity: 0.92,
      isPrimary: false,
    };
  }

  if (connectionType === 'stream') {
    const c = isDark ? '#ffffff' : '#000000';
    return { stroke: c, markerColor: c, strokeWidth: 1.5, opacity: 1, isPrimary: false };
  }
  if (connectionType === 'event') {
    const c = isDark ? '#ffffff' : '#000000';
    return { stroke: c, markerColor: c, strokeWidth: 1.5, opacity: 1, isPrimary: false };
  }
  if (connectionType === 'dep') {
    const c = palette ? palette.dep : isDark ? MUTED.dark : MUTED.light;
    return { stroke: c, markerColor: c, strokeWidth: 1.25, opacity: 0.8, isPrimary: false };
  }

  if (control || importance === 'supporting' || importance === 'optional') {
    const c = palette ? palette.supporting : isDark ? MUTED.supportingDark : MUTED.supportingLight;
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: EDGE_CONFIG.strokeWidth,
      opacity: importance === 'optional' ? 0.7 : 0.8,
      isPrimary: false,
    };
  }

  if (primary) {
    const c = palette ? palette.primary : isDark ? '#ffffff' : '#000000';
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: sketch ? 1.5 : 1.5,
      opacity: 1,
      isPrimary: true,
    };
  }

  // Secondary sync — merged to same black as primary per product requirement.
  const c = palette ? palette.default : isDark ? '#ffffff' : '#000000';
  return {
    stroke: c,
    markerColor: c,
    strokeWidth: sketch ? 1.5 : 1.5,
    opacity: 1,
    isPrimary: false,
  };
}
