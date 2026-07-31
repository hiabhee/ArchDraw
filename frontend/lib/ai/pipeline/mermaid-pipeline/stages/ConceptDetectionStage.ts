import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { detectImplicitConceptPrompt } from '../conceptTemplates';

export interface ConceptDetectionOutput {
  implicitConcept: ReturnType<typeof detectImplicitConceptPrompt>;
  promptLower: string;
  isVerticalRequested: boolean;
}

export class ConceptDetectionStage extends BaseStage<string, ConceptDetectionOutput> {
  constructor() {
    super('concept-detection', { description: 'Detect implicit concepts in prompt', weight: 1 });
  }

  async execute(input: string, _context: PipelineContext): Promise<StageResult<ConceptDetectionOutput>> {
    const promptLower = input.toLowerCase();
    const implicitConcept = detectImplicitConceptPrompt(input);

    const isVerticalRequested =
      promptLower.includes('vertical') ||
      promptLower.includes('vertically') ||
      promptLower.includes('top-to-bottom') ||
      promptLower.includes('top to bottom') ||
      promptLower.includes('graph td') ||
      promptLower.includes('graph tb') ||
      promptLower.includes('vertical layout');

    return successResult({ implicitConcept, promptLower, isVerticalRequested });
  }
}
