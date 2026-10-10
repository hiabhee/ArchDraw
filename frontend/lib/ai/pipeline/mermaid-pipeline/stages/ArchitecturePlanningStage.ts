import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/diagram/pipeline-core';
import type { PipelineContext } from '@/lib/diagram/pipeline-core';
import { runArchitecturePlanner } from '../architecturePlanner';
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
  /** Concept diagrams have curated components that may be terminal by design. */
  isConceptTemplate?: boolean;
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

    let plan: Awaited<ReturnType<typeof runArchitecturePlanner>>;
    let usedFallback = false;
    if (implicitConcept && !inEditMode) {
      // Short concept prompts have curated plans; avoid waiting on the LLM for
      // a result the template path can build deterministically.
      plan = getConceptTemplatePlan(implicitConcept, detailLevel);
    } else {
      try {
        plan = await runArchitecturePlanner(prompt, diagramSize, detailLevel, model, existingContext);
      } catch (err) {
        // Never replace an edit or an unknown topic with a generic web stack.
        if (inEditMode || !implicitConcept) {
          return errorResult(err instanceof Error ? err : new Error(String(err)));
        }
        logger.warn('[PlanningStage] Planner failed; using a matching concept template', err);
        plan = getConceptTemplatePlan(implicitConcept, detailLevel);
        usedFallback = true;
      }
    }

    return successResult({
      ...plan,
      usedFallback,
      droppedExistingContext: false,
      inEditMode,
      isConceptTemplate: Boolean(implicitConcept),
    });
  }
}
