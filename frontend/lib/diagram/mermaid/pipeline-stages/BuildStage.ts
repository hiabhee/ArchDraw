import { BaseStage, type StageResult, successResult } from '@/lib/diagram/pipeline-core';
import type { PipelineContext } from '@/lib/diagram/pipeline-core';
import { buildReactFlowObjects } from '../buildReactFlow';
import { markBackwardAreaEdges } from '../areaFlowOrder';
import type { MermaidAST, RFObjects } from '../types';

export class BuildStage extends BaseStage<MermaidAST, RFObjects> {
  constructor() {
    super('build', { description: 'Build ReactFlow objects from AST', weight: 1 });
  }

  async execute(input: MermaidAST, context: PipelineContext): Promise<StageResult<RFObjects>> {
    const built = buildReactFlowObjects(input, {
      sizing: context.metadata.layoutProfile === 'studio-minimal' ? 'studio' : undefined,
    });
    // Areas written in data-flow order: edges back to an earlier area are feedback.
    const areaOrder = context.metadata.areaOrder as 'flow' | readonly string[] | undefined;
    const objects = areaOrder ? markBackwardAreaEdges(built, Array.isArray(areaOrder) ? areaOrder : undefined) : built;
    return successResult(objects);
  }
}
