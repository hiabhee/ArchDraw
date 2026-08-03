import type { RFNode, RFEdge, RFObjects } from '@/lib/mermaid/types';
import { convertNodes, type NodeInput, type NodeConverterOptions } from './NodeConverter';
import { convertEdges, type EdgeInput, type EdgeConverterOptions } from './EdgeConverter';

export interface ReactFlowAdapterOptions {
  nodeOptions?: NodeConverterOptions;
  edgeOptions?: EdgeConverterOptions;
  metadata?: Record<string, unknown>;
}

export interface ReactFlowResult {
  nodes: RFNode[];
  edges: RFEdge[];
  metadata: Record<string, unknown>;
}

export class ReactFlowAdapter<TDiagram> {
  constructor(
    private extractors: {
      extractNodes: (diagram: TDiagram) => NodeInput[];
      extractEdges: (diagram: TDiagram) => EdgeInput[];
      extractMetadata?: (diagram: TDiagram) => Record<string, unknown>;
    }
  ) {}

  adapt(diagram: TDiagram, options: ReactFlowAdapterOptions = {}): ReactFlowResult {
    const nodeInputs = this.extractors.extractNodes(diagram);
    const edgeInputs = this.extractors.extractEdges(diagram);
    const metadata = {
      ...this.extractors.extractMetadata?.(diagram),
      ...options.metadata,
    };

    const nodes = convertNodes(nodeInputs, options.nodeOptions);
    const edges = convertEdges(edgeInputs, options.edgeOptions);

    return { nodes, edges, metadata };
  }
}
