import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { buildReactFlowObjects } from '../buildReactFlow';
import type { MermaidAST, RFObjects } from '../types';

export class BuildStage extends BaseStage<MermaidAST, RFObjects> {
  constructor() {
    super('build', { description: 'Build ReactFlow objects from AST', weight: 1 });
  }

  async execute(input: MermaidAST, _context: PipelineContext): Promise<StageResult<RFObjects>> {
    const objects = buildReactFlowObjects(input);
    return successResult(objects);
  }
}
