import { BaseStage, type StageResult, successResult, warningResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import type { MermaidAST } from '../types';
import { sanitizeMermaidAST } from '../sanitize';

export interface SanitizeStageInput {
  ast: MermaidAST;
  reduceRedundantEdges?: boolean;
  /** Architecture-only semantic cleanup. Workflows must retain action nodes. */
  diagramKind?: 'architecture' | 'workflow';
  pruneOrphans?: boolean;
}

export class SanitizeStage extends BaseStage<SanitizeStageInput, MermaidAST> {
  constructor() {
    super('sanitize', { description: 'Sanitize hallucinated nodes, tier reversals, and redundant generated edges', weight: 1 });
  }

  async execute(input: SanitizeStageInput, _context: PipelineContext): Promise<StageResult<MermaidAST>> {
    // Heuristic deletions can erase valid workflow steps, callbacks and replicas.
    // Restrict them to architecture generation; workflows legitimately use
    // action nodes and repeated steps.
    // Callers that are round-tripping an existing canvas do not provide an
    // intent; preserve that graph exactly. Generated diagrams pass the kind
    // explicitly from the AI materializer.
    if (!input.diagramKind && !input.reduceRedundantEdges) return successResult(input.ast);
    if (input.diagramKind === 'workflow') return successResult(input.ast);
    const result = sanitizeMermaidAST(input.ast, {
      reduceRedundantEdges: input.reduceRedundantEdges,
      diagramKind: input.diagramKind,
      pruneOrphans: input.pruneOrphans,
    });
    if (result.warnings.length > 0) {
      return warningResult(result.ast, result.warnings);
    }
    return successResult(result.ast);
  }
}
