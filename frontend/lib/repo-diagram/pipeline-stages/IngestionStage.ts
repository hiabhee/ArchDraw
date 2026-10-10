import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { ingestRepo } from '@/lib/github-ingestion';
import type { RepoSnapshot } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';
import { DEFAULT_FILE_BUDGET, DEFAULT_CONTENT_BUDGET_KB } from '@/lib/repo-diagram/skip-rules';

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
    // GH2R-006: level-aware budgets single-sourced from skip-rules.ts (was 500/1000/2000 + 10000 regardless of level)
    const FILE_BUDGETS: Record<number, number> = DEFAULT_FILE_BUDGET;
    const detail = input.detailLevel ?? 2;
    const ingestOpts = {
      fileBudget: FILE_BUDGETS[detail] ?? 900,
      contentBudgetKB: DEFAULT_CONTENT_BUDGET_KB[detail] ?? 8000,
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
