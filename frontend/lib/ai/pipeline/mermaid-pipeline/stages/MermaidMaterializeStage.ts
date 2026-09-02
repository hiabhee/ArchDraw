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

    // LayoutOverrideStage already normalised the direction for this plan
    // (TD when the user asked for vertical, LR otherwise). Retry/fallback must
    // keep that decision instead of forcing horizontal — otherwise a user who
    // requested a layered vertical diagram gets flipped to LR on regeneration.
    const intendedDirection =
      currentPlan.formatConfig.diagramType === 'graph TD' ? 'graph TD' : 'graph LR';
    // Rewrite the Mermaid header to the intended direction without touching the body.
    const withDirection = (code: string, dir: 'graph TD' | 'graph LR'): string =>
      code.replace(/^graph (?:TD|LR)/m, dir);

    let parseResult = await runMermaidPipeline(currentPlan.mermaidCode);

    if (!isDomainSuccess(parseResult) || parseResult.data.nodes.length === 0) {
      logger.warn('[Pipeline] Planner failed or returned 0 nodes. Retrying with stronger instructions...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Classify the user's intent first. Generate valid Mermaid with 3-6 components that match the topic — do NOT default to Browser, Load Balancer, and Database unless the prompt requires a web stack.`;
      try {
        const retryPlan = await runArchitecturePlanner(retryPrompt, diagramSize, detailLevel, model);
        const retryCode = withDirection(retryPlan.mermaidCode, intendedDirection);
        parseResult = await runMermaidPipeline(retryCode);
        currentPlan = {
          ...currentPlan,
          mermaidCode: retryCode,
          formatConfig: { ...currentPlan.formatConfig, diagramType: intendedDirection },
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
      const fallbackCode = withDirection(fallback.mermaidCode, intendedDirection);
      currentPlan = {
        ...currentPlan,
        ...fallback,
        mermaidCode: fallbackCode,
        formatConfig: {
          ...(fallback.formatConfig ?? currentPlan.formatConfig),
          diagramType: intendedDirection,
        },
      };
      parseResult = await runMermaidPipeline(fallbackCode);

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
