import type { CSSProperties } from 'react';
import type { Edge } from 'reactflow';
import { DIAGRAM_CONSTANTS } from '@/constants/diagram';
import { getEdgeConfig, type EdgeType } from '@/data/edgeTypes';

type EdgeStyleInput = Pick<CSSProperties, 'strokeDasharray'> | undefined;

function normalizeDash(value: string): string {
  return value.trim().replace(/\s+/g, ',');
}

export function isAsyncEdge(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.async === true) return true;

  const connectionType = String(data.connectionType || data.edgeType || '').toLowerCase();
  if (connectionType === 'async' || connectionType === 'publish' || connectionType === 'consume') {
    return true;
  }

  const label = String(data.label || '').toLowerCase();
  return ['amqp', 'kafka', 'queue', 'pub/sub', 'event', 'publish', 'consume', 'nats', 'rabbitmq'].some(
    (token) => label.includes(token),
  );
}

/** Canonical dash pattern shared by canvas edges and SVG/PNG export. */
export function resolveEdgeStrokeDasharray(
  data: Record<string, unknown> | undefined,
  edgeStyle?: EdgeStyleInput,
): string | undefined {
  const styleDash = edgeStyle?.strokeDasharray;
  if (styleDash !== undefined && styleDash !== null && styleDash !== '' && styleDash !== 'none') {
    return normalizeDash(String(styleDash));
  }

  const edgeVariant = data?.edgeVariant as string | undefined;
  const edgeType = (data?.edgeType || data?.connectionType) as EdgeType | undefined;
  const asyncEdge = isAsyncEdge(data);

  if (edgeVariant === 'dashed' || asyncEdge) {
    return DIAGRAM_CONSTANTS.edge.dashArray;
  }
  if (edgeVariant === 'dotted') {
    return '2,2';
  }
  if (edgeVariant === 'feedback') {
    return '12,4,4,4';
  }

  const configDash = getEdgeConfig(edgeType).dash;
  return configDash ? normalizeDash(configDash) : undefined;
}

export function resolveEdgeStrokeDasharrayFromEdge(edge: Edge): string | undefined {
  return resolveEdgeStrokeDasharray(
    edge.data as Record<string, unknown> | undefined,
    edge.style as EdgeStyleInput,
  );
}
