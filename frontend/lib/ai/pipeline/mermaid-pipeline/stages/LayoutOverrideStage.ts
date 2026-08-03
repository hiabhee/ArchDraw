import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import type { ArchitecturePlan } from './ArchitecturePlanningStage';
import type { ConceptDetectionOutput } from './ConceptDetectionStage';
import logger from '@/lib/logger';

export interface LayoutOverrideInput {
  plan: ArchitecturePlan;
  conceptDetection: ConceptDetectionOutput;
}

export class LayoutOverrideStage extends BaseStage<LayoutOverrideInput, ArchitecturePlan> {
  constructor() {
    super('layout-override', { description: 'Override layout direction based on prompt', weight: 1 });
  }

  async execute(input: LayoutOverrideInput, _context: PipelineContext): Promise<StageResult<ArchitecturePlan>> {
    const { plan, conceptDetection } = input;
    const { implicitConcept, isVerticalRequested } = conceptDetection;

    let mermaidCode = plan.mermaidCode;
    const formatConfig = { ...plan.formatConfig };

    if (implicitConcept) {
      logger.info(`[ConceptTemplate] Using implicit concept compiler: ${implicitConcept.subject} (${implicitConcept.domain})`);
      formatConfig.diagramType = 'graph LR';
      mermaidCode = mermaidCode.replace(/^graph TD/m, 'graph LR');
    } else if (isVerticalRequested) {
      logger.info('[DownstreamGuard] Override: vertical layout requested. Forcing graph TD.');
      formatConfig.diagramType = 'graph TD';
      mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
    } else {
      logger.info('[DownstreamGuard] Forcing default layout to vertical (graph TD).');
      formatConfig.diagramType = 'graph TD';
      mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
    }

    return successResult({ ...plan, mermaidCode, formatConfig });
  }
}
