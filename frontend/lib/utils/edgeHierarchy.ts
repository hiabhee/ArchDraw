/**
 * Primary-vs-secondary edge hierarchy for canvas + SVG export.
 * Spine / importance metadata comes from clarityCompiler + edgeClassifier.
 */

import { EDGE_CONFIG } from '@/lib/config';
import { EDGE_STYLES, FLOW_ACCENT } from '@/lib/theme/stylingConstants';
import { isAsyncEdge } from '@/lib/utils/edgeStroke';

export interface EdgeVisual {
  stroke: string;
  markerColor: string;
  strokeWidth: number;
  opacity: number;
  isPrimary: boolean;
}

const MUTED = {
  light: '#64748b',
  dark: '#94a3b8',
  supportingLight: '#94a3b8',
  supportingDark: '#64748b',
  asyncLight: EDGE_STYLES.async.color,
  asyncDark: '#d97706',
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
 */
export function resolveEdgeVisual(
  data: Record<string, unknown> | undefined,
  isDark: boolean,
): EdgeVisual {
  const async = isAsyncEdge(data);
  const primary = !async && isPrimaryEdge(data);
  const control = isControlPlane(data);
  const importance = typeof data?.importance === 'string' ? data.importance : 'secondary';
  const connectionType = String(data?.connectionType || '').toLowerCase();

  if (async) {
    const c = isDark ? MUTED.asyncDark : MUTED.asyncLight;
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: EDGE_STYLES.async.width,
      opacity: 0.92,
      isPrimary: false,
    };
  }

  if (connectionType === 'stream') {
    return { stroke: '#10B981', markerColor: '#10B981', strokeWidth: 1.35, opacity: 0.9, isPrimary: false };
  }
  if (connectionType === 'event') {
    return { stroke: '#8B5CF6', markerColor: '#8B5CF6', strokeWidth: 1.35, opacity: 0.9, isPrimary: false };
  }
  if (connectionType === 'dep') {
    const c = isDark ? MUTED.dark : MUTED.light;
    return { stroke: c, markerColor: c, strokeWidth: 1.25, opacity: 0.8, isPrimary: false };
  }

  if (control || importance === 'supporting' || importance === 'optional') {
    const c = isDark ? MUTED.supportingDark : MUTED.supportingLight;
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: EDGE_CONFIG.strokeWidth,
      opacity: importance === 'optional' ? 0.7 : 0.8,
      isPrimary: false,
    };
  }

  if (primary) {
    // High-contrast request path — black/white reads clearly; FLOW_ACCENT for thick variant.
    const useBrand = data?.edgeVariant === 'thick';
    const c = useBrand ? FLOW_ACCENT : isDark ? '#ffffff' : '#0f172a';
    return {
      stroke: c,
      markerColor: c,
      strokeWidth: EDGE_STYLES.primary.width,
      opacity: 1,
      isPrimary: true,
    };
  }

  // Secondary sync — slightly quieter than spine, still clearly visible.
  const c = isDark ? MUTED.dark : MUTED.light;
  return {
    stroke: c,
    markerColor: c,
    strokeWidth: 1.4,
    opacity: 0.9,
    isPrimary: false,
  };
}
