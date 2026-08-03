import type { RFEdge } from '@/lib/mermaid/types';

export interface EdgeInput {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  data?: Record<string, unknown>;
  markerEnd?: Record<string, unknown>;
  markerStart?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface EdgeConverterOptions {
  defaultEdgeType?: string;
  transformData?: (edge: EdgeInput) => Record<string, unknown>;
  transformStyle?: (edge: EdgeInput) => Record<string, unknown>;
}

export function convertEdges(
  inputs: EdgeInput[],
  options: EdgeConverterOptions = {}
): RFEdge[] {
  const {
    defaultEdgeType = 'simpleFloating',
    transformData,
    transformStyle,
  } = options;

  return inputs.map(input => {
    const data = transformData ? transformData(input) : (input.data || {});

    return {
      id: input.id,
      source: input.source,
      target: input.target,
      sourceHandle: input.sourceHandle ?? null,
      targetHandle: input.targetHandle ?? null,
      type: input.type || defaultEdgeType,
      label: input.label,
      data,
      animated: input.animated ?? false,
      markerEnd: input.markerEnd ?? undefined,
      markerStart: input.markerStart ?? undefined,
      style: transformStyle ? transformStyle(input) : (input.style ?? undefined),
    };
  });
}
