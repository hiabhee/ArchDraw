import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { runArchitecturePlanner } from '../stage1-planner';
import { getConceptTemplatePlan } from '../conceptTemplates';
import type { ConceptDetectionOutput } from './ConceptDetectionStage';
import type { UserIntent } from '../../../types';
import logger from '@/lib/logger';

export interface ArchitecturePlan {
  formatConfig: {
    format: 'mermaid';
    diagramType: 'graph TD' | 'graph LR' | 'erDiagram' | 'sequenceDiagram' | 'C4Context' | 'C4Container';
    optionalVariants: string[];
  };
  styleConfig: {
    primaryColor: string;
    secondaryColor: string;
    background: string;
    backgroundColor?: string;
    fontFamily: string;
    theme: string;
    nodeTypeStyles?: Record<string, string>;
  };
  mermaidCode: string;
  reasoning?: string;
  usedFallback: boolean;
  droppedExistingContext: boolean;
  inEditMode: boolean;
}

export interface ArchitecturePlanningInput {
  prompt: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  model?: string;
  existingContext?: UserIntent['existingContext'];
  conceptDetection: ConceptDetectionOutput;
}

export class ArchitecturePlanningStage extends BaseStage<ArchitecturePlanningInput, ArchitecturePlan> {
  constructor() {
    super('architecture-planning', { description: 'Plan architecture via LLM', weight: 5 });
  }

  async execute(input: ArchitecturePlanningInput, _context: PipelineContext): Promise<StageResult<ArchitecturePlan>> {
    const { prompt, diagramSize, detailLevel, model, existingContext, conceptDetection } = input;
    const { implicitConcept } = conceptDetection;
    const inEditMode = Boolean(
      existingContext && (existingContext.nodes?.length || existingContext.edges?.length)
    );

    const useConceptTemplate = Boolean(implicitConcept) && detailLevel >= 2;

    let plan: {
      formatConfig: ArchitecturePlan['formatConfig'];
      styleConfig: ArchitecturePlan['styleConfig'];
      mermaidCode: string;
      reasoning?: string;
    };

    if (useConceptTemplate && !inEditMode) {
      const templatePlan = getConceptTemplatePlan(implicitConcept!, detailLevel);
      plan = {
        formatConfig: templatePlan.formatConfig,
        styleConfig: templatePlan.styleConfig,
        mermaidCode: templatePlan.mermaidCode,
        reasoning: templatePlan.reasoning,
      };
    } else {
      try {
        plan = await runArchitecturePlanner(prompt, diagramSize, detailLevel, model, existingContext);
      } catch (err) {
        logger.warn('[PlanningStage] Architecture planner failed:', err);
        return errorResult(new Error('Architecture planner failed'));
      }
    }

    return successResult({
      ...plan,
      usedFallback: false,
      droppedExistingContext: false,
      inEditMode,
    });
  }
}
