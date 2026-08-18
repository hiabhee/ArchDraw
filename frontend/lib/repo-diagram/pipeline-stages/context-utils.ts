import type { PipelineContext } from '@/lib/pipeline-core';

/**
 * Shared detail-level resolution for repo pipeline stages. Prefer this over
 * local copies so every stage reads the same context metadata.
 */
export function detailLevelFromContext(
  context: PipelineContext,
  fallback?: 1 | 2 | 3,
): 1 | 2 | 3 {
  const fromMeta = context.metadata.detailLevel;
  if (fromMeta === 1 || fromMeta === 2 || fromMeta === 3) return fromMeta;
  return fallback ?? 2;
}
