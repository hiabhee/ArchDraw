import { Pipeline, pipelineStages, toDomainResult } from '@/lib/pipeline-core';
import type { DomainPipelineResult, Stage } from '@/lib/pipeline-core';
import { IngestStage } from './pipeline-stages/IngestionStage';
import type { IngestionInput } from './pipeline-stages/IngestionStage';
import { CacheCheckStage } from './pipeline-stages/CacheCheckStage';
import { AnalysisStage } from './pipeline-stages/AnalysisStage';
import { BaselineStage } from './pipeline-stages/BaselineStage';
import { ClassifyStage } from './pipeline-stages/ClassifyStage';
import { ExtractStage } from './pipeline-stages/ExtractStage';
import { RelationshipsStage } from './pipeline-stages/RelationshipsStage';
import { VerifyStage } from './pipeline-stages/VerifyStage';
import { DocsReviewStage } from './pipeline-stages/DocsReviewStage';
import { FinalizationStage } from './pipeline-stages/FinalizationStage';
import { CacheWriteStage } from './pipeline-stages/CacheWriteStage';
import type { PipelineResult as RepoPipelineResult } from '@/lib/types/repo-diagram';
import type { PipelineProgressEvent } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';

const PROGRESS_STAGE_MAP: Record<string, PipelineProgressEvent['stage']> = {
  ingesting: 'ingesting',
  'cache-check': 'ingesting',
  analysis: 'detecting_subsystems',
  baseline: 'extracting_signals',
  classifying: 'classifying',
  extracting_components: 'extracting_components',
  analyzing_relationships: 'analyzing_relationships',
  verifying: 'verifying',
  docs_review: 'verifying',
  finalization: 'compiling',
  'cache-write': 'done',
};

/** Flat stage list — no mega-orchestrator. Exported for characterization tests. */
export function createRepoDiagramStages(): Stage<IngestionInput, RepoPipelineResult>[] {
  return pipelineStages<IngestionInput, RepoPipelineResult>(
    new IngestStage(),
    new CacheCheckStage(),
    new AnalysisStage(),
    new BaselineStage(),
    new ClassifyStage(),
    new ExtractStage(),
    new RelationshipsStage(),
    new VerifyStage(),
    new DocsReviewStage(),
    new FinalizationStage(),
    new CacheWriteStage()
  );
}

/**
 * Domain entry point — returns a typed success/failure result (does not throw).
 * API routes may map failures to HTTP / SSE errors via `code`.
 */
export async function generateRepoArchitectureDiagramV2(
  repoUrl: string,
  detailLevel?: 1 | 2 | 3,
  signal?: AbortSignal,
  userGithubToken?: string,
  onProgress?: (event: PipelineProgressEvent) => void
): Promise<DomainPipelineResult<RepoPipelineResult>> {
  const resolvedDetailLevel = detailLevel ?? 2;
  const pipelineTimeoutMs = Number(process.env.REPO_PIPELINE_TIMEOUT_MS) || 180_000;
  const timeoutController = new AbortController();
  const abortFromCaller = () => timeoutController.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abortFromCaller();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }
  let timedOut = false;
  const timeoutError = new Error(`Repository diagram pipeline timed out after ${pipelineTimeoutMs}ms`);
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort(timeoutError);
  }, pipelineTimeoutMs);
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const pipeline = new Pipeline<IngestionInput, RepoPipelineResult>(
    'repo-pipeline-v2',
    createRepoDiagramStages()
  );

  const ingestInput: IngestionInput = {
    repoUrl,
    detailLevel: resolvedDetailLevel,
    userGithubToken,
  };

  try {
    const pipelineRun = pipeline.execute(ingestInput, {
      signal: timeoutController.signal,
      context: {
        metadata: {
          repoUrl,
          detailLevel: resolvedDetailLevel,
          stageTimeoutMs: Number(process.env.REPO_STAGE_TIMEOUT_MS) || 30_000,
          // GH2R-018: thread per-request token presence so Finalization can tailor reviewNotes (avoid "Set GITHUB_TOKEN" when user supplied github_pat_)
          userGithubTokenPresent: Boolean(userGithubToken),
        },
      },
      onProgress: (stage: string, progress: number, message: string) => {
        onProgress?.({
          stage: PROGRESS_STAGE_MAP[stage] || 'compiling',
          message,
          progress,
        });
      },
    });
    const result = await Promise.race([
      pipelineRun,
      new Promise<never>((_, reject) => { deadlineTimer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort(timeoutError);
        reject(timeoutError);
      }, pipelineTimeoutMs); }),
    ]);

    const domain = toDomainResult(result);
    if (!domain.success) {
      logger.error('[PipelineV2] Pipeline failed:', domain.error, domain.code);
    }
    return domain;
  } catch (error) {
    if (!timedOut) throw error;
    return {
      success: false,
      error: timeoutError,
      code: 'aborted',
      warnings: ['Repository diagram generation exceeded its time limit and was aborted.'],
      aborted: true,
    };
  } finally {
    clearTimeout(timeout);
    if (deadlineTimer) clearTimeout(deadlineTimer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
