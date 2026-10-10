import type { CSSProperties } from 'react';
import type { Edge } from 'reactflow';
import { DIAGRAM_CONSTANTS } from '@/lib/diagram/constants/diagram';
import { getEdgeConfig, type EdgeType } from '@/data/edgeTypes';

type EdgeStyleInput = Pick<CSSProperties, 'strokeDasharray'> | undefined;

function normalizeDash(value: string): string {
  return value.trim().replace(/\s+/g, ',');
}

export function isAsyncEdge(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.async === true) return true;
  // Self-loops (retry/feedback) should always be dashed, not solid primary blue
  if (data.selfLoopStyle || data.loopVariant) return true;

  const connectionType = String(data.connectionType || data.edgeType || '').toLowerCase();
  if (connectionType === 'async' || connectionType === 'publish' || connectionType === 'consume') {
    return true;
  }

  const label = String(data.label || '').toLowerCase();
  return ['amqp', 'kafka', 'queue', 'pub/sub', 'event', 'publish', 'consume', 'nats', 'rabbitmq', 'retry', 'backoff', 'failure', 'dlq', 'feedback', 'loop'].some(
    (token) => label.includes(token),
  );
}

/** Canonical dash pattern shared by canvas edges and SVG/PNG export.
 *
 * Solid by default: only explicit style overrides, explicit dashed/dotted
 * variants, control-plane edges (diagnostic/optional importance or
 * observability ports), and explicitly user-chosen edge types render dashed.
 * Inferred async signals (connectionType/async labels from pipelines) stay
 * solid — they are distinguished by color/animation instead.
 */
export function resolveEdgeStrokeDasharray(
  data: Record<string, unknown> | undefined,
  edgeStyle?: EdgeStyleInput,
): string | undefined {
  const styleDash = edgeStyle?.strokeDasharray;
  if (styleDash !== undefined && styleDash !== null && styleDash !== '' && styleDash !== 'none') {
    return normalizeDash(String(styleDash));
  }

  const edgeVariant = data?.edgeVariant as string | undefined;

  if (edgeVariant === 'dashed') {
    return DIAGRAM_CONSTANTS.edge.dashArray;
  }
  if (edgeVariant === 'dotted') {
    return '2,2';
  }
  if (edgeVariant === 'feedback') {
    return '12,4,4,4';
  }

  // Control-plane edges (observability/health/optional) stay dashed so the
  // primary request path reads as solid by contrast.
  const importance = data?.importance as string | undefined;
  if (
    importance === 'diagnostic' ||
    importance === 'optional' ||
    data?.portType === 'observability'
  ) {
    return DIAGRAM_CONSTANTS.edge.dashArray;
  }

  // Explicit user-chosen edge type (Properties panel / templates) keeps its
  // configured dash. Pipeline-inferred `connectionType` alone stays solid.
  const edgeType = data?.edgeType as EdgeType | undefined;
  if (edgeType) {
    const configDash = getEdgeConfig(edgeType).dash;
    return configDash ? normalizeDash(configDash) : undefined;
  }
  return undefined;
}

export function resolveEdgeStrokeDasharrayFromEdge(edge: Edge): string | undefined {
  return resolveEdgeStrokeDasharray(
    edge.data as Record<string, unknown> | undefined,
    edge.style as EdgeStyleInput,
  );
}
