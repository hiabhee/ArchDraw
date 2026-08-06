import type { UserIntent } from '../../types';
import type { ConceptDetectionOutput } from './stages/ConceptDetectionStage';
import type { ArchitecturePlan } from './stages/ArchitecturePlanningStage';
import type { MermaidMaterializeOutput } from './stages/MermaidMaterializeStage';
import type { ScoreOutput } from './stages/ScoreStage';
import type { ValidationOutput } from './stages/ValidationStage';

/** Accumulated state flowing through the AI Mermaid pipeline stages. */
export interface AiPipelineData {
  userIntent: UserIntent;
  prompt: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  conceptDetection?: ConceptDetectionOutput;
  plan?: ArchitecturePlan;
  parseOutput?: MermaidMaterializeOutput;
  scoreOutput?: ScoreOutput;
  validationOutput?: ValidationOutput;
}

/** Pipeline output after all stages succeed. */
export type CompletedAiPipelineData = AiPipelineData & {
  conceptDetection: ConceptDetectionOutput;
  plan: ArchitecturePlan;
  parseOutput: MermaidMaterializeOutput;
  scoreOutput: ScoreOutput;
  validationOutput: ValidationOutput;
};

export function assertCompletedAiPipelineData(data: AiPipelineData): CompletedAiPipelineData {
  if (
    !data.conceptDetection ||
    !data.plan ||
    !data.parseOutput ||
    !data.scoreOutput ||
    !data.validationOutput
  ) {
    throw new Error('AI pipeline finished without required stage outputs');
  }
  return data as CompletedAiPipelineData;
}

export function createInitialAiPipelineData(userIntent: UserIntent): Pick<
  AiPipelineData,
  'userIntent' | 'prompt' | 'diagramSize' | 'detailLevel'
> {
  return {
    userIntent,
    prompt: userIntent.description,
    diagramSize: userIntent.diagramSize ?? 'medium',
    detailLevel: userIntent.detailLevel ?? 2,
  };
}
