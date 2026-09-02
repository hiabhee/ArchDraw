import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { analyzeRelationships } from '@/lib/agents/repo-relationship-analyst';
import { detailLevelFromContext } from './context-utils';
import type { RepoEnrichmentState } from './enrichment-types';
import { recomputeDegradedAnything } from './enrichment-types';
import logger from '@/lib/logger';

export class RelationshipsStage extends BaseStage<RepoEnrichmentState, RepoEnrichmentState> {
  constructor() {
    super('analyzing_relationships', {
      description: 'Analyze relationships and workflows between components',
      weight: 2,
    });
  }

  async execute(input: RepoEnrichmentState, context: PipelineContext): Promise<StageResult<RepoEnrichmentState>> {
    if (!input.useLlm) {
      return successResult(input);
    }

    let currentEdges = input.edges;
    let currentWorkflows = input.workflows;
    let llmEdgeFailed = false;

    context.onProgress?.('analyzing_relationships', 80, 'Analyzing relationships...');
    try {
      const relOutput = await analyzeRelationships(
        input.snapshot,
        input.workingNodes,
        input.repoProfile ?? undefined,
        { dependencies: input.dependencyMapDeps },
        input.summaries ?? [],
        input.detectionReportText ?? '',
        { importGraph: input.importGraph, signals: input.signals },
        { detailLevel: detailLevelFromContext(context) },
      );
      if (relOutput.edges.length > 0) currentEdges = relOutput.edges;
      if (relOutput.workflows.length > 0) currentWorkflows = relOutput.workflows;
    } catch {
      logger.warn('[Pipeline] LLM relationship analysis failed');
      llmEdgeFailed = true;
    }

    const degraded = recomputeDegradedAnything({
      ...input.degraded,
      edges: llmEdgeFailed,
    });

    return successResult({
      ...input,
      edges: currentEdges,
      workflows: currentWorkflows,
      degraded,
    });
  }
}
