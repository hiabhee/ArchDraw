import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import type { ArchitecturePlan } from './ArchitecturePlanningStage';
import type { ConceptDetectionOutput } from './ConceptDetectionStage';

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
    const { isVerticalRequested, promptLower } = conceptDetection;
    const horizontal = /\b(horizontal|horizontally|left[- ]to[- ]right|graph lr)\b/.test(promptLower);
    const header = plan.mermaidCode.match(/^\s*(?:graph|flowchart)\s+(TD|TB|LR)\b/m)?.[1];
    const direction = isVerticalRequested ? 'TD' : horizontal ? 'LR'
      : header === 'TD' || header === 'TB' ? 'TD' : header === 'LR' ? 'LR'
      : plan.formatConfig.diagramType === 'graph TD' ? 'TD' : 'LR';
    const mermaidCode = plan.mermaidCode.replace(/^(\s*)(?:graph|flowchart)\s+(?:TD|TB|LR)\b/m, `$1graph ${direction}`);
    const formatConfig = { ...plan.formatConfig, diagramType: `graph ${direction}` as 'graph TD' | 'graph LR' };

    return successResult({ ...plan, mermaidCode, formatConfig });
  }
}
