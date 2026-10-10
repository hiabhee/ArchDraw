import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { validateAgainstDocs } from '@/lib/agents/repo-docs-validator';
import { applyReviewCorrections } from '@/lib/repo-diagram/graph-quality';
import type { RepoEnrichmentState } from './enrichment-types';
import { detailLevelFromContext } from './context-utils';
import logger from '@/lib/logger';

/**
 * GH2R-024 — Docs revalidation pass (Verify → DocsReview → Finalization).
 *
 * The deterministic VerifyStage prunes to hard evidence; this stage re-checks the
 * surviving graph AGAINST the repository's own README/docs (phase 1.5 metaFiles)
 * and applies minimal LLM corrections: add doc-described components/edges, drop
 * doc-empty hallucinations, rename to the docs' canonical naming.
 *
 * Best-effort: if the LLM call fails, the verified graph flows through unchanged
 * and `docsReviewFailed` is surfaced in the final reviewNotes.
 */
export class DocsReviewStage extends BaseStage<RepoEnrichmentState, RepoEnrichmentState> {
  constructor() {
    super('docs_review', {
      description: 'Re-check the graph against the repository documentation',
      weight: 1,
    });
  }

  async execute(input: RepoEnrichmentState, context: PipelineContext): Promise<StageResult<RepoEnrichmentState>> {
    if (!input.useLlm) {
      return successResult(input);
    }

    const metaFiles = input.snapshot.metaFiles ?? [];
    const hasDocs = metaFiles.some(
      (f) => /^(.+\/)?README(\.[a-z0-9]+)?$/i.test(f.path) || /\.md$/i.test(f.path)
    );
    if (!hasDocs) {
      logger.log('[DocsReviewStage] No README/docs — docs revalidation skipped');
      return successResult(input);
    }

    context.onProgress?.('verifying', 78, 'Re-checking against documentation...');

    try {
      const review = await validateAgainstDocs({
        nodes: input.workingNodes,
        edges: input.edges,
        workflows: input.workflows,
        metaFiles,
        fileTree: input.snapshot.fileTree,
        detailLevel: detailLevelFromContext(context),
      });

      if (!review || review.corrections === undefined) {
        return successResult(input);
      }

      const hasChanges =
        review.corrections.addNodes.length > 0 ||
        review.corrections.removeNodeIds.length > 0 ||
        review.corrections.mergeNodes.length > 0 ||
        review.corrections.addEdges.length > 0 ||
        review.corrections.removeEdgeIndexes.length > 0 ||
        review.corrections.updateEdges.length > 0;

      if (!hasChanges) {
        logger.log('[DocsReviewStage] Docs review approved graph without changes');
        return successResult({ ...input, docsReviewNotes: review.reviewNotes, docsReviewFailed: false });
      }

      const corrected = applyReviewCorrections(
        input.workingNodes,
        input.edges,
        input.workflows,
        review.corrections
      );
      logger.log(
        `[DocsReviewStage] Applied docs corrections: +${review.corrections.addNodes.length} nodes, -${review.corrections.removeNodeIds.length} removed, ${review.corrections.mergeNodes.length} merges, +${review.corrections.addEdges.length} edges, ${review.corrections.removeEdgeIndexes.length} edge removals`
      );

      return successResult({
        ...input,
        workingNodes: corrected.nodes,
        edges: corrected.edges,
        workflows: corrected.workflows,
        docsReviewNotes: review.reviewNotes,
        docsReviewFailed: false,
      });
    } catch (err) {
      logger.warn('[DocsReviewStage] Docs revalidation failed — keeping verified graph:', err);
      return successResult({ ...input, docsReviewFailed: true });
    }
  }
}