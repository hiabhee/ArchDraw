import { redis } from '@/lib/redis';
import logger from '@/lib/logger';
import type { PipelineResult } from '@/lib/types/repo-diagram';
import { PIPELINE_VERSION } from './pipelineVersion';

const TTL_SECONDS = 30 * 60; // 30 minutes — matches existing in-memory TTL

function key(repoUrl: string, headSha: string, detailLevel?: 1 | 2 | 3): string {
  // GH2R-003: level-scoped, matching diagramCache
  return `repo-diagram:${PIPELINE_VERSION}:${repoUrl}:${headSha}:L${detailLevel ?? 2}`;
}

function keyLegacy(repoUrl: string, headSha: string): string {
  return `repo-diagram:${PIPELINE_VERSION}:${repoUrl}:${headSha}`;
}

export async function getRepoDiagramFromRedis(
  repoUrl: string,
  headSha: string,
  detailLevel?: 1 | 2 | 3
): Promise<PipelineResult | null> {
  if (!redis) return null;
  try {
    const primary = await redis.get<PipelineResult>(key(repoUrl, headSha, detailLevel));
    if (primary) return primary;
    // Compat fallback for rolling deploy — only for default level 2 / undefined
    if (detailLevel === undefined || detailLevel === 2) {
      const legacy = await redis.get<PipelineResult>(keyLegacy(repoUrl, headSha));
      if (legacy) return legacy;
    }
    return null;
  } catch (e) {
    logger.warn(`[RedisCache] getRepoDiagramFromRedis failed: ${(e as Error).message}`);
    return null;
  }
}

export async function setRepoDiagramInRedis(
  repoUrl: string,
  headSha: string,
  result: PipelineResult,
  detailLevel?: 1 | 2 | 3
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key(repoUrl, headSha, detailLevel), result, { ex: TTL_SECONDS });
    // Also write legacy key during migration window for old readers (only default level)
    if (detailLevel === undefined || detailLevel === 2) {
      await redis.set(keyLegacy(repoUrl, headSha), result, { ex: TTL_SECONDS });
    }
  } catch (e) {
    logger.warn(`[RedisCache] setRepoDiagramInRedis failed: ${(e as Error).message}`);
  }
}
