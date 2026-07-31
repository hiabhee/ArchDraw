import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { runArchitecturePlanner } from '../stage1-planner';
import { generateFallbackPlan } from './FallbackPlan';
import type { ArchitecturePlan } from './ArchitecturePlanningStage';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import logger from '@/lib/logger';

export interface MermaidParseOutput {
  nodes: RFNode[];
  edges: RFEdge[];
  parseWarnings: string[];
  plan: ArchitecturePlan;
  usedFallback: boolean;
  droppedExistingContext: boolean;
}

export interface MermaidParseInput {
  plan: ArchitecturePlan;
  prompt: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  model?: string;
}

export class MermaidParseStage extends BaseStage<MermaidParseInput, MermaidParseOutput> {
  constructor() {
    super('mermaid-parse', { description: 'Parse mermaid code to ReactFlow', weight: 3 });
  }

  async execute(input: MermaidParseInput, _context: PipelineContext): Promise<StageResult<MermaidParseOutput>> {
    const { plan, prompt, diagramSize, detailLevel, model } = input;
    let currentPlan = { ...plan };
    let usedFallback = false;
    let droppedExistingContext = false;

    let parseResult = runMermaidPipeline(currentPlan.mermaidCode);

    if (!parseResult.success || parseResult.nodes.length === 0) {
      logger.warn('[Pipeline] Planner failed or returned 0 nodes. Retrying with stronger instructions...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Generate valid, complete Mermaid flowchart code containing at least 3-6 components.`;
      try {
        const retryPlan = await runArchitecturePlanner(retryPrompt, diagramSize, detailLevel, model);
        let retryCode = retryPlan.mermaidCode.replace(/^graph LR/m, 'graph TD');
        parseResult = runMermaidPipeline(retryCode);
        currentPlan = {
          ...currentPlan,
          mermaidCode: retryCode,
          formatConfig: { ...currentPlan.formatConfig, diagramType: 'graph TD' },
          reasoning: retryPlan.reasoning,
        };
      } catch {
        logger.warn('[Pipeline] Retry planning failed');
      }
    }

    if (!parseResult.success || parseResult.nodes.length === 0) {
      logger.warn('[Pipeline] Parser still returned 0 nodes. Using fallback plan.');
      usedFallback = true;
      const fallback = generateFallbackPlan(prompt);
      currentPlan = { ...currentPlan, ...fallback };
      let fallbackCode = fallback.mermaidCode.replace(/^graph LR/m, 'graph TD');
      parseResult = runMermaidPipeline(fallbackCode);
      currentPlan.mermaidCode = fallbackCode;

      if (plan.inEditMode) {
        droppedExistingContext = true;
      }
    }

    if (!parseResult.success) {
      return errorResult(new Error('Failed to parse mermaid after retries and fallback'),
        parseResult.warnings
      );
    }

    return successResult({
      nodes: parseResult.nodes,
      edges: parseResult.edges,
      parseWarnings: parseResult.warnings,
      plan: currentPlan,
      usedFallback,
      droppedExistingContext,
    });
  }
}
