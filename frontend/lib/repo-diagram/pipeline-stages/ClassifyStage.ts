import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { buildStaticDetectionReport, formatDetectionReport } from '@/lib/repo-diagram/static-detector';
import { classifyRepository } from '@/lib/agents/repo-classifier';
import { buildFallbackRepoProfile } from '@/lib/agents/repo-deep-classifier';
import { buildDependencyIntelligence, buildSummariesForLLM, gatherPass2Files } from './internal-helpers';
import { detailLevelFromContext } from './context-utils';
import type { EnrichmentInput, RepoEnrichmentState } from './enrichment-types';
import { emptyDegraded } from './enrichment-types';
import logger from '@/lib/logger';

export class ClassifyStage extends BaseStage<EnrichmentInput, RepoEnrichmentState> {
  constructor() {
    super('classifying', {
      description: 'Classify repository architecture and gather pass-2 files',
      weight: 3,
    });
  }

  async execute(input: EnrichmentInput, context: PipelineContext): Promise<StageResult<RepoEnrichmentState>> {
    const { snapshot, subsystems, signals, importGraph, baselineNodes, baselineEdges, workflows } = input;
    const detailLevel = detailLevelFromContext(context, input.detailLevel);

    const hasAnySourceFiles = snapshot.phase2Files.length >= 1 || snapshot.selectedFiles.length >= 4;
    const hasAnySignals = signals.length >= 3;
    const useLlm = detailLevel !== 1 && (hasAnySourceFiles || hasAnySignals);

    const baseState: RepoEnrichmentState = {
      snapshot,
      subsystems,
      signals,
      importGraph,
      baselineNodes,
      baselineEdges,
      workflows,
      workingNodes: baselineNodes,
      edges: baselineEdges,
      repoProfile: null,
      useLlm,
      degraded: emptyDegraded(snapshot),
      dependencyMapDeps: buildDependencyIntelligence(signals),
      preVerifierHighEdgeCount: 0,
    };

    if (!useLlm) {
      logger.info(
        `[Pipeline] Skipping LLM — ${
          detailLevel === 1
            ? 'detailLevel=1 (static-only)'
            : `repo appears empty (files=${snapshot.selectedFiles.length}, signals=${signals.length})`
        }`
      );
      return successResult(baseState);
    }

    const summaries = buildSummariesForLLM(subsystems, signals);
    context.onProgress?.('classifying', 50, 'Classifying architecture...');
    const detectionReport = buildStaticDetectionReport(snapshot, subsystems, signals);
    const detectionReportText = formatDetectionReport(detectionReport);

    let repoProfile = baseState.repoProfile;
    let classifyFailed = false;

    try {
      repoProfile = await classifyRepository(snapshot, detectionReportText, summaries);
      classifyFailed = repoProfile.confidence === 'low';
      logger.log(`  Type: ${repoProfile.repoType}, pattern: ${repoProfile.architecturePattern}`);
    } catch (err) {
      logger.warn('[Pipeline] Classification failed, using fallback:', err);
      repoProfile = buildFallbackRepoProfile(snapshot);
      classifyFailed = true;
    }

    // Immutable snapshot update for pass-2 files (no in-place mutation)
    let nextSnapshot = snapshot;
    if (repoProfile) {
      const pass2 = await gatherPass2Files(snapshot, repoProfile, detailLevel === 3 ? 40 : 25);
      if (pass2.length > 0) {
        logger.info(`[Pipeline] Pass 2: +${pass2.length} files`);
        nextSnapshot = {
          ...snapshot,
          selectedFiles: [...snapshot.selectedFiles, ...pass2],
          phase2Files: [...snapshot.phase2Files, ...pass2],
        };
      }
    }

    return successResult({
      ...baseState,
      snapshot: nextSnapshot,
      repoProfile,
      degraded: {
        ...baseState.degraded,
        classify: classifyFailed,
        anything: classifyFailed || baseState.degraded.ingestion,
      },
      detectionReportText,
      summaries,
    });
  }
}
