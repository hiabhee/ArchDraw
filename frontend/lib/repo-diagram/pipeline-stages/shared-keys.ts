import { sharedKey } from '@/lib/pipeline-core';

export type CacheWriteShared = {
  headSha?: string;
  shouldCache: boolean;
};

/** Typed shared-data keys for the repo diagram pipeline. */
export const REPO_SHARED = {
  cacheWrite: sharedKey<CacheWriteShared>('cacheWrite'),
} as const;
