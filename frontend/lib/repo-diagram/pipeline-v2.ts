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
  verifying: 'analyzing_relationships',
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
  const pipeline = new Pipeline<IngestionInput, RepoPipelineResult>(
    'repo-pipeline-v2',
    createRepoDiagramStages()
  );

  const ingestInput: IngestionInput = {
    repoUrl,
    detailLevel: resolvedDetailLevel,
    userGithubToken,
  };

  const result = await pipeline.execute(ingestInput, {
    signal,
    context: {
      metadata: { repoUrl, detailLevel: resolvedDetailLevel },
    },
    onProgress: (stage: string, progress: number, message: string) => {
      onProgress?.({
        stage: PROGRESS_STAGE_MAP[stage] || 'compiling',
        message,
        progress,
      });
    },
  });

  const domain = toDomainResult(result);
  if (!domain.success) {
    logger.error('[PipelineV2] Pipeline failed:', domain.error, domain.code);
  }
  return domain;
}
