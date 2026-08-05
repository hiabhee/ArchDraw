import { BaseStage, type StageResult, successResult, errorResult, isDomainSuccess } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { runArchitecturePlanner } from '../architecturePlanner';
import { generateFallbackPlan } from './FallbackPlan';
import type { ArchitecturePlan } from './ArchitecturePlanningStage';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import logger from '@/lib/logger';

export interface MermaidMaterializeOutput {
  nodes: RFNode[];
  edges: RFEdge[];
  parseWarnings: string[];
  plan: ArchitecturePlan;
  usedFallback: boolean;
  droppedExistingContext: boolean;
}

export interface MermaidMaterializeInput {
  plan: ArchitecturePlan;
  prompt: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  model?: string;
}

/**
 * Materialize an architecture plan into ReactFlow nodes/edges.
 * Owns parse + planner retry + fallback — not "parse only".
 */
export class MermaidMaterializeStage extends BaseStage<MermaidMaterializeInput, MermaidMaterializeOutput> {
  constructor() {
    super('mermaid-materialize', {
      description: 'Materialize Mermaid plan to ReactFlow (parse, retry, fallback)',
      weight: 3,
    });
  }

  async execute(
    input: MermaidMaterializeInput,
    _context: PipelineContext
  ): Promise<StageResult<MermaidMaterializeOutput>> {
    const { plan, prompt, diagramSize, detailLevel, model } = input;
    let currentPlan = { ...plan };
    let usedFallback = false;
    let droppedExistingContext = false;

    let parseResult = await runMermaidPipeline(currentPlan.mermaidCode);

    if (!isDomainSuccess(parseResult) || parseResult.data.nodes.length === 0) {
      logger.warn('[Pipeline] Planner failed or returned 0 nodes. Retrying with stronger instructions...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Generate valid, complete Mermaid flowchart code containing at least 3-6 components.`;
      try {
        const retryPlan = await runArchitecturePlanner(retryPrompt, diagramSize, detailLevel, model);
        const retryCode = retryPlan.mermaidCode.replace(/^graph LR/m, 'graph TD');
        parseResult = await runMermaidPipeline(retryCode);
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

    if (!isDomainSuccess(parseResult) || parseResult.data.nodes.length === 0) {
      logger.warn('[Pipeline] Parser still returned 0 nodes. Using fallback plan.');
      usedFallback = true;
      const fallback = generateFallbackPlan(prompt);
      currentPlan = { ...currentPlan, ...fallback };
      const fallbackCode = fallback.mermaidCode.replace(/^graph LR/m, 'graph TD');
      parseResult = await runMermaidPipeline(fallbackCode);
      currentPlan.mermaidCode = fallbackCode;

      if (plan.inEditMode) {
        droppedExistingContext = true;
      }
    }

    if (!isDomainSuccess(parseResult)) {
      return errorResult(
        new Error('Failed to materialize mermaid after retries and fallback'),
        parseResult.warnings
      );
    }

    return successResult({
      nodes: parseResult.data.nodes,
      edges: parseResult.data.edges,
      parseWarnings: parseResult.data.warnings,
      plan: currentPlan,
      usedFallback,
      droppedExistingContext,
    });
  }
}
