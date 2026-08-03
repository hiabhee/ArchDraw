import { BaseStage, type StageResult, successResult, getSharedTyped } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { setRepoDiagramInRedis } from '@/lib/ai/services/repoDiagramRedisCache';
import type { PipelineResult as RepoPipelineResult } from '@/lib/types/repo-diagram';
import { REPO_SHARED } from './shared-keys';
import type { CacheWriteShared } from './shared-keys';
import logger from '@/lib/logger';

export type { CacheWriteShared } from './shared-keys';

/**
 * Optional cache write — compile success is not entangled with Redis failures.
 */
export class CacheWriteStage extends BaseStage<RepoPipelineResult, RepoPipelineResult> {
  constructor() {
    super('cache-write', {
      description: 'Persist diagram result to memory + Redis caches',
      weight: 1,
      optional: true,
    });
  }

  async execute(
    result: RepoPipelineResult,
    context: PipelineContext
  ): Promise<StageResult<RepoPipelineResult>> {
    const write = getSharedTyped(context, REPO_SHARED.cacheWrite);
    const repoUrl =
      (typeof context.metadata.repoUrl === 'string' && context.metadata.repoUrl) || '';

    if (!write?.shouldCache || !write.headSha || !repoUrl) {
      return successResult(result);
    }

    try {
      setRepoDiagram(repoUrl, write.headSha, result);
      await setRepoDiagramInRedis(repoUrl, write.headSha, result);
      return successResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cache write failed';
      logger.warn(`[Pipeline] Cache write failed: ${message}`);
      return successResult(result, [`Cache write failed: ${message}`]);
    }
  }
}
