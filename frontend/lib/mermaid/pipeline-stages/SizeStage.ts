import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { sizeSubgraphs } from '../subgraphSizing';
import type { RFNode } from '../types';

export class SizeStage extends BaseStage<RFNode[], RFNode[]> {
  constructor() {
    super('size', { description: 'Size subgraph containers', weight: 1 });
  }

  async execute(input: RFNode[], _context: PipelineContext): Promise<StageResult<RFNode[]>> {
    const sized = sizeSubgraphs(input);
    return successResult(sized);
  }
}
