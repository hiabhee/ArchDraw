import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { ingestRepo } from '@/lib/github-ingestion';
import type { RepoSnapshot } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';

export interface IngestionInput {
  repoUrl: string;
  detailLevel: 1 | 2 | 3;
  userGithubToken?: string;
}

export interface IngestionOutput {
  snapshot: RepoSnapshot;
  FILE_BUDGETS: Record<number, number>;
}

export class IngestStage extends BaseStage<IngestionInput, IngestionOutput> {
  constructor() {
    super('ingesting', { description: 'Ingest repository from GitHub', weight: 2 });
  }

  async execute(input: IngestionInput, context: PipelineContext): Promise<StageResult<IngestionOutput>> {
    const FILE_BUDGETS: Record<number, number> = { 1: 500, 2: 1000, 3: 2000 };
    const ingestOpts = {
      fileBudget: FILE_BUDGETS[input.detailLevel ?? 2] ?? 1000,
      contentBudgetKB: 10000,
    };

    try {
      context.onProgress?.('ingesting', 5, 'Fetching repository...');
      const snapshot = await ingestRepo(
        input.repoUrl,
        ingestOpts,
        context.signal,
        input.userGithubToken
      );

      if (context.signal?.aborted) {
        return errorResult(new Error('Request aborted'));
      }

      logger.info(`[Pipeline] Ingestion complete: ${snapshot.selectedFiles.length} files`);
      return successResult({ snapshot, FILE_BUDGETS });
    } catch (err) {
      return errorResult(err instanceof Error ? err : new Error('Ingestion failed'));
    }
  }
}
