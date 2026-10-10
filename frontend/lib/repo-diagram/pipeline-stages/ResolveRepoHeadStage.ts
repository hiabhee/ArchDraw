import { BaseStage, type StageResult, successResult, errorResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { resolveRepoHead } from '@/lib/github-ingestion';
import type { IngestionInput, ResolvedRepoInput } from './IngestionStage';

export class ResolveRepoHeadStage extends BaseStage<IngestionInput, ResolvedRepoInput> {
  constructor() { super('resolve-head', { description: 'Resolve repository revision', weight: 1 }); }

  async execute(input: IngestionInput, context: PipelineContext): Promise<StageResult<ResolvedRepoInput>> {
    try {
      context.onProgress?.('ingesting', 2, 'Checking repository version...');
      const resolvedHead = await resolveRepoHead(input.repoUrl, context.signal, input.userGithubToken);
      return successResult({ ...input, resolvedHead });
    } catch (error) {
      return errorResult(error instanceof Error ? error : new Error('Could not resolve repository revision'));
    }
  }
}
