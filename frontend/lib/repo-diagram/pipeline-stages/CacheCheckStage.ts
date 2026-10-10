import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import type { PipelineResult as RepoPipelineResult } from '@/lib/types/repo-diagram';
import type { ResolvedRepoInput } from './IngestionStage';
import { getRepoDiagram, setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { getRepoDiagramFromRedis } from '@/lib/ai/services/repoDiagramRedisCache';
import { detailLevelFromContext } from './context-utils';
import logger from '@/lib/logger';

export class CacheCheckStage extends BaseStage<ResolvedRepoInput, ResolvedRepoInput | RepoPipelineResult> {
  constructor() {
    super('cache-check', { description: 'Check for cached diagram result', weight: 1, optional: true });
  }

  async execute(input: ResolvedRepoInput, context: PipelineContext): Promise<StageResult<ResolvedRepoInput | RepoPipelineResult>> {
    const repoUrl = input.repoUrl;
    const headSha = input.resolvedHead.headSha;

    const detailLevel = detailLevelFromContext(context);
    let cached = getRepoDiagram(repoUrl, headSha, detailLevel);
    if (!cached) {
      cached = await getRepoDiagramFromRedis(repoUrl, headSha, detailLevel);
      if (cached) {
        setRepoDiagram(repoUrl, headSha, cached, detailLevel);
        logger.info(`[Pipeline] Redis cache hit for ${repoUrl} (L${detailLevel})`);
      }
    }

    if (cached) {
      logger.info(`[Pipeline] Cache hit for ${repoUrl} @ ${headSha.slice(0, 7)} L${detailLevel}`);
      return successResult(cached, [`Cache hit for ${repoUrl}`], { terminal: true });
    }

    logger.info(`[Pipeline] Cache miss for ${repoUrl} @ ${headSha.slice(0, 7)} L${detailLevel}`);
    return successResult(input);
  }
}
