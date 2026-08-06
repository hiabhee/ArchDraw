import { pipelineStages } from '@/lib/pipeline-core';
import type { Stage } from '@/lib/pipeline-core/Stage';
import type { StageResult } from '@/lib/pipeline-core/StageResult';
import { successResult, errorResult } from '@/lib/pipeline-core/StageResult';
import type { PipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { UserIntent } from '../../types';
import type { AiPipelineData } from './aiPipelineTypes';
import { createInitialAiPipelineData } from './aiPipelineTypes';
import {
  ConceptDetectionStage,
  ArchitecturePlanningStage,
  LayoutOverrideStage,
  MermaidMaterializeStage,
  ScoreStage,
  ValidationStage,
} from './stages';
import type { ArchitecturePlanningInput } from './stages/ArchitecturePlanningStage';
import type { ArchitectureStyle } from '../types';

const conceptDetectionStage = new ConceptDetectionStage();
const architecturePlanningStage = new ArchitecturePlanningStage();
const layoutOverrideStage = new LayoutOverrideStage();
const mermaidMaterializeStage = new MermaidMaterializeStage();
const scoreStage = new ScoreStage();
const validationStage = new ValidationStage();

/**
 * Flat AI Mermaid pipeline — class stages wired directly without placeholder blobs.
 * Exported for characterization tests.
 */
export function createAiMermaidStages(): Stage<UserIntent, AiPipelineData>[] {
  return pipelineStages<UserIntent, AiPipelineData>(
    {
      name: 'concept-detection',
      description: 'Detect implicit concepts from prompt',
      weight: 1,
      async execute(userIntent: UserIntent, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const base = createInitialAiPipelineData(userIntent);
        const conceptResult = await conceptDetectionStage.execute(base.prompt, context);
        if (!conceptResult.success || !conceptResult.data) {
          return errorResult(conceptResult.error ?? new Error('Concept detection failed'), conceptResult.warnings);
        }
        return successResult({ ...base, conceptDetection: conceptResult.data });
      },
    },
    {
      name: 'architecture-planning',
      description: 'Plan architecture via LLM or concept template',
      weight: 5,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        if (!data.conceptDetection) {
          return errorResult(new Error('Architecture planning requires concept detection'));
        }
        const planningInput: ArchitecturePlanningInput = {
          prompt: data.prompt,
          diagramSize: data.diagramSize,
          detailLevel: data.detailLevel,
          model: data.userIntent.model,
          existingContext: data.userIntent.existingContext,
          conceptDetection: data.conceptDetection,
        };
        const planResult = await architecturePlanningStage.execute(planningInput, context);
        if (!planResult.success || !planResult.data) {
          return errorResult(planResult.error ?? new Error('Architecture planning failed'), planResult.warnings);
        }
        return successResult({ ...data, plan: planResult.data });
      },
    },
    {
      name: 'layout-override',
      description: 'Apply layout direction overrides',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        if (!data.plan || !data.conceptDetection) {
          return errorResult(new Error('Layout override requires plan and concept detection'));
        }
        const result = await layoutOverrideStage.execute(
          { plan: data.plan, conceptDetection: data.conceptDetection },
          context
        );
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Layout override failed'), result.warnings);
        }
        return successResult({ ...data, plan: result.data });
      },
    },
    {
      name: 'mermaid-materialize',
      description: 'Materialize mermaid plan (parse, retry, fallback)',
      weight: 3,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        if (!data.plan) {
          return errorResult(new Error('Mermaid materialize requires architecture plan'));
        }
        const result = await mermaidMaterializeStage.execute(
          {
            plan: data.plan,
            prompt: data.prompt,
            diagramSize: data.diagramSize,
            detailLevel: data.detailLevel,
            model: data.userIntent.model,
          },
          context
        );
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Mermaid materialize failed'), result.warnings);
        }
        return successResult({ ...data, parseOutput: result.data, plan: result.data.plan });
      },
    },
    {
      name: 'scoring',
      description: 'Score the diagram',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        if (!data.parseOutput || !data.plan) {
          return errorResult(new Error('Scoring requires materialized diagram and plan'));
        }
        const result = await scoreStage.execute(
          {
            nodes: data.parseOutput.nodes,
            edges: data.parseOutput.edges,
            diagramSize: data.diagramSize,
            detailLevel: data.detailLevel,
            styleTheme: data.plan.styleConfig.theme,
            prompt: data.prompt,
            stylePlan: {
              style: data.plan.styleConfig.theme as ArchitectureStyle,
              strictness: 'explicit' as const,
              productionDepth: 'conceptual' as const,
            },
          },
          context
        );
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Scoring failed'), result.warnings);
        }
        return successResult({ ...data, scoreOutput: result.data });
      },
    },
    {
      name: 'validation',
      description: 'Validate diagram quality',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        if (!data.parseOutput || !data.plan) {
          return errorResult(new Error('Validation requires materialized diagram and plan'));
        }
        const result = await validationStage.execute(
          {
            nodes: data.parseOutput.nodes,
            edges: data.parseOutput.edges,
            reasoning: data.plan.reasoning,
            diagramSize: data.diagramSize,
            detailLevel: data.detailLevel,
            parseWarnings: data.parseOutput.parseWarnings,
          },
          context
        );
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Validation failed'), result.warnings);
        }
        return successResult({ ...data, validationOutput: result.data });
      },
    }
  );
}
