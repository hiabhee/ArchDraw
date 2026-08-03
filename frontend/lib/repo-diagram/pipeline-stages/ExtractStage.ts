import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { extractComponents } from '@/lib/agents/repo-component-extractor';
import { extractComponentsHeuristic } from '@/lib/agents/repo-heuristic-extractor';
import { mergeLlmIntoBaseline } from './internal-helpers';
import type { RepoEnrichmentState } from './enrichment-types';
import { recomputeDegradedAnything } from './enrichment-types';
import logger from '@/lib/logger';

export class ExtractStage extends BaseStage<RepoEnrichmentState, RepoEnrichmentState> {
  constructor() {
    super('extracting_components', {
      description: 'Extract architectural components via LLM or heuristics',
      weight: 3,
    });
  }

  async execute(input: RepoEnrichmentState, context: PipelineContext): Promise<StageResult<RepoEnrichmentState>> {
    if (!input.useLlm) {
      return successResult(input);
    }

    const {
      snapshot,
      baselineNodes,
      repoProfile,
      detectionReportText = '',
      summaries = [],
    } = input;

    let workingNodes = input.workingNodes;
    let heuristicComponentFallback = false;

    const runHeuristic = () => {
      const heuristicNodes = extractComponentsHeuristic(snapshot, repoProfile ?? undefined);
      if (heuristicNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baselineNodes, heuristicNodes);
      }
    };

    context.onProgress?.('extracting_components', 65, 'Extracting components...');
    if (!repoProfile) {
      heuristicComponentFallback = true;
      runHeuristic();
    } else {
      try {
        const llmNodes = await extractComponents(snapshot, repoProfile, detectionReportText, summaries);
        if (llmNodes.length > 0) {
          workingNodes = mergeLlmIntoBaseline(baselineNodes, llmNodes);
          logger.log(`  Baseline: ${baselineNodes.length}, LLM: ${llmNodes.length}, Merged: ${workingNodes.length}`);
        }
      } catch (err) {
        logger.warn('[Pipeline] Component extraction failed, using heuristic fallback:', err);
        heuristicComponentFallback = true;
        runHeuristic();
      }
    }

    const degraded = recomputeDegradedAnything({
      ...input.degraded,
      extract: heuristicComponentFallback,
    });

    return successResult({
      ...input,
      workingNodes,
      degraded,
    });
  }
}
