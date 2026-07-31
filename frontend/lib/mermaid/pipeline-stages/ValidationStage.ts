import { BaseStage, type StageResult, successResult, warningResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { validateDiagramOutput } from '../validation';
import type { RFNode, RFEdge, Direction } from '../types';

export interface ValidationStageInput {
  nodes: RFNode[];
  edges: RFEdge[];
  direction?: Direction;
}

export interface ValidationStageOutput {
  nodes: RFNode[];
  edges: RFEdge[];
  validationWarnings: string[];
}

export class FinalValidationStage extends BaseStage<ValidationStageInput, ValidationStageOutput> {
  constructor() {
    super('final-validation', { description: 'Validate final diagram output', weight: 1 });
  }

  async execute(input: ValidationStageInput, _context: PipelineContext): Promise<StageResult<ValidationStageOutput>> {
    const report = validateDiagramOutput(input.nodes, input.edges, input.direction);
    const validationWarnings = report.warnings.map(w => `[${w.type}] ${w.message}`);

    if (validationWarnings.length > 0) {
      return warningResult(
        { nodes: input.nodes, edges: input.edges, validationWarnings },
        validationWarnings
      );
    }

    return successResult({
      nodes: input.nodes,
      edges: input.edges,
      validationWarnings: [],
    });
  }
}
