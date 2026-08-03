import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { applyRfLayout } from '@/lib/pipeline-shared/layout/IntegratedLayout';
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
    const layouted = applyRfLayout(
      input.objects as unknown as Parameters<typeof applyRfLayout>[0],
      input.direction
    ) as unknown as RFObjects;
    return successResult(layouted);
  }
}
