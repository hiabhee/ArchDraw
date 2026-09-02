/**
 * Bump when pipeline semantics change so cached diagram/repo results are invalidated.
 * Single source of truth shared by diagramCache.ts and repoDiagramRedisCache.ts.
 * v8: GH2R-003 cache key now scoped by detailLevel (L1/L2/L3) — old v7 keys without level are compat-read but new writes include level.
 */
export const PIPELINE_VERSION = 'v8';
