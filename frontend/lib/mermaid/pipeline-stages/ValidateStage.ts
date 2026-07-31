import { BaseStage, type StageResult, errorResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { validateAST } from '../validate';
import type { MermaidAST } from '../types';

export class ValidateStage extends BaseStage<MermaidAST, MermaidAST> {
  constructor() {
    super('validate', { description: 'Validate Mermaid AST structure', weight: 1 });
  }

  async execute(input: MermaidAST, _context: PipelineContext): Promise<StageResult<MermaidAST>> {
    const result = validateAST(input);
    if (!result.ok) {
      const warnings = result.errors.map(e => `[${e.type}] ${e.message}`);
      return errorResult(new Error('AST validation failed'), warnings);
    }
    return successResult(result.ast);
  }
}
