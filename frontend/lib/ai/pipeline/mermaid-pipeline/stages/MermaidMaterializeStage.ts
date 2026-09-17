import { BaseStage, type StageResult, successResult, errorResult, isDomainSuccess } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { runArchitecturePlanner } from '../architecturePlanner';
import type { UserIntent } from '../../../types';
import type { ArchitecturePlan } from './ArchitecturePlanningStage';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import logger from '@/lib/logger';
import { inferDiagramKind } from '../diagramIntent';

export interface MermaidMaterializeOutput {
  nodesRemoved?: number;
  edgesRemoved?: number;
  groupsRemoved?: number;
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
  existingContext?: UserIntent['existingContext'];
}

/**
 * Materialize an architecture plan into ReactFlow nodes/edges.
 * Owns parsing and one syntax-repair pass without replacing the requested graph.
 */
export class MermaidMaterializeStage extends BaseStage<MermaidMaterializeInput, MermaidMaterializeOutput> {
  constructor() {
    super('mermaid-materialize', {
      description: 'Materialize Mermaid plan to ReactFlow (parse and syntax repair)',
      weight: 3,
    });
  }

  async execute(
    input: MermaidMaterializeInput,
    _context: PipelineContext
  ): Promise<StageResult<MermaidMaterializeOutput>> {
    const { plan, prompt, diagramSize, detailLevel, model, existingContext } = input;
    let currentPlan = { ...plan };
    const usedFallback = plan.usedFallback;
    const droppedExistingContext = plan.droppedExistingContext;

    // LayoutOverrideStage already normalised the direction for this plan
    // (preserving the planner unless the user explicitly overrides it). Retries must
    // keep that decision instead of forcing horizontal — otherwise a user who
    // requested a layered vertical diagram gets flipped to LR on regeneration.
    const intendedDirection =
      currentPlan.formatConfig.diagramType === 'graph TD' ? 'graph TD' : 'graph LR';
    // Rewrite the Mermaid header to the intended direction without touching the body.
    const withDirection = (code: string, dir: 'graph TD' | 'graph LR'): string =>
      code.replace(/^(\s*)(?:graph|flowchart)\s+(?:TD|TB|LR)\b/m, `$1${dir}`);

    const materializeOptions = {
      diagramKind: inferDiagramKind(prompt),
      // Generated architecture diagrams should not keep disconnected invented
      // infrastructure nodes such as an unused Redis cache. Existing edits
      // retain their nodes because they are user-owned content.
      pruneOrphans: inferDiagramKind(prompt) === 'architecture' && !plan.inEditMode && !plan.isConceptTemplate,
    };
    let parseResult = await runMermaidPipeline(currentPlan.mermaidCode, materializeOptions);

    // A malformed planner response can parse its node declarations while
    // losing every relationship, after which orphan pruning makes the result
    // look deceptively successful. Treat that as a materialization failure so
    // the syntax-repair retry gets a chance to recover the requested graph.
    const hasMermaidEdges = /(?:-->|-.+->|==>|~~~)/.test(currentPlan.mermaidCode);
    const isCatastrophicLoss = isDomainSuccess(parseResult) && hasMermaidEdges &&
      (parseResult.data.edges.length === 0 ||
        (parseResult.data.nodesRemoved ?? 0) >= Math.max(5, Math.ceil(parseResult.data.nodes.length * 2)));

    if (!isDomainSuccess(parseResult) || parseResult.data.nodes.length === 0 || isCatastrophicLoss) {
      logger.warn('[Pipeline] Planner failed or returned 0 nodes. Retrying with stronger instructions...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Classify the user's intent first. Repair the Mermaid syntax while preserving every requested component and relationship — do NOT default to Browser, Load Balancer, and Database unless the prompt requires a web stack.\nPrevious Mermaid:\n${currentPlan.mermaidCode}\nParser feedback: ${JSON.stringify(parseResult.warnings ?? [])}`;
      try {
        const retryPlan = await runArchitecturePlanner(retryPrompt, diagramSize, detailLevel, model, existingContext);
        const retryCode = withDirection(retryPlan.mermaidCode, intendedDirection);
        parseResult = await runMermaidPipeline(retryCode, materializeOptions);
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

    const retryStillCatastrophic = isDomainSuccess(parseResult) && hasMermaidEdges &&
      (parseResult.data.edges.length === 0 ||
        (parseResult.data.nodesRemoved ?? 0) >= Math.max(5, Math.ceil(parseResult.data.nodes.length * 2)));
    if (!isDomainSuccess(parseResult) || parseResult.data.nodes.length === 0 || retryStillCatastrophic) {
      return errorResult(new Error('Failed to materialize the requested diagram after syntax repair'), parseResult.warnings);
    }

    return successResult({
      nodesRemoved: parseResult.data.nodesRemoved ?? 0,
      edgesRemoved: parseResult.data.edgesRemoved ?? 0,
      groupsRemoved: parseResult.data.groupsRemoved ?? 0,
      nodes: parseResult.data.nodes,
      edges: parseResult.data.edges,
      parseWarnings: parseResult.data.warnings,
      plan: currentPlan,
      usedFallback,
      droppedExistingContext,
    });
  }
}
