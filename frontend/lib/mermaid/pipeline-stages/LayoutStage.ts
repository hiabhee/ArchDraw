import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { applyLayout } from '../layout';
import type { RFObjects, Direction } from '../types';

export interface LayoutStageInput {
  objects: RFObjects;
  direction: Direction;
}

export class LayoutStage extends BaseStage<LayoutStageInput, RFObjects> {
  constructor() {
    super('layout', { description: 'Apply optimized layout to nodes', weight: 2 });
  }

  async execute(input: LayoutStageInput, _context: PipelineContext): Promise<StageResult<RFObjects>> {
    // Use the improved layout function with better spacing
    const layouted = applyLayout(input.objects, input.direction);
    return successResult(layouted);
  }
}
