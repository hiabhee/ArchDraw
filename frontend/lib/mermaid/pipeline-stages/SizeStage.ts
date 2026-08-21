import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { applySubgraphBoundsToRf } from '../recomputeSubgraphBounds';
import type { RFNode } from '../types';

export class SizeStage extends BaseStage<RFNode[], RFNode[]> {
  constructor() {
    super('size', { description: 'Size subgraph containers', weight: 1 });
  }

  async execute(input: RFNode[], _context: PipelineContext): Promise<StageResult<RFNode[]>> {
    // Canonical nesting-aware sizing (also used by repo import): resizes every
    // group to its children's bounds — innermost first — and makes child
    // positions parent-relative.
    const sized = applySubgraphBoundsToRf(input);
    return successResult(sized);
  }
}
