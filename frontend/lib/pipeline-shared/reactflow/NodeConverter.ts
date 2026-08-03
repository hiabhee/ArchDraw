import type { RFNode } from '@/lib/mermaid/types';

export interface NodeInput {
  id: string;
  label: string;
  type?: string;
  position?: { x: number; y: number };
  parentNode?: string;
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
  zIndex?: number;
}

export interface NodeConverterOptions {
  defaultNodeType?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  isGroup?: (node: NodeInput) => boolean;
  transformData?: (node: NodeInput) => Record<string, unknown>;
  transformStyle?: (node: NodeInput) => Record<string, unknown>;
}

export function convertNodes(
  inputs: NodeInput[],
  options: NodeConverterOptions = {}
): RFNode[] {
  const {
    defaultNodeType = 'shapeNode',
    defaultWidth = 180,
    defaultHeight = 60,
    isGroup,
    transformData,
    transformStyle,
  } = options;

  return inputs.map(input => {
    const nodeType = input.type || (isGroup?.(input) ? 'groupNode' : defaultNodeType);
    const data = transformData ? transformData(input) : (input.data || {});
    if (!data.label && input.label) {
      data.label = input.label;
    }
    if (nodeType === 'groupNode') {
      data.isGroup = true;
    }

    return {
      id: input.id,
      type: nodeType,
      position: input.position || { x: 0, y: 0 },
      data,
      parentNode: input.parentNode,
      width: input.width || defaultWidth,
      height: input.height || defaultHeight,
      style: transformStyle ? transformStyle(input) : (input.style || undefined),
      zIndex: input.zIndex ?? (nodeType === 'groupNode' ? -1 : undefined),
    };
  });
}
