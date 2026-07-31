import { redis } from '@/lib/redis';
import logger from '@/lib/logger';
import type { PipelineResult } from '@/lib/types/repo-diagram';

const TTL_SECONDS = 30 * 60; // 30 minutes — matches existing in-memory TTL
const PIPELINE_VERSION = 'v6'; // Keep in sync with diagramCache.ts

function key(repoUrl: string, headSha: string): string {
  return `repo-diagram:${PIPELINE_VERSION}:${repoUrl}:${headSha}`;
}

export async function getRepoDiagramFromRedis(
  repoUrl: string,
  headSha: string
): Promise<PipelineResult | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get<PipelineResult>(key(repoUrl, headSha));
    return raw ?? null;
  } catch (e) {
    logger.warn(`[RedisCache] getRepoDiagramFromRedis failed: ${(e as Error).message}`);
    return null;
  }
}

export async function setRepoDiagramInRedis(
  repoUrl: string,
  headSha: string,
  result: PipelineResult
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key(repoUrl, headSha), result, { ex: TTL_SECONDS });
  } catch (e) {
    logger.warn(`[RedisCache] setRepoDiagramInRedis failed: ${(e as Error).message}`);
  }
}
