import type { CodeGraph } from '../repo-diagram/code-graph';
import type { CompactFileSummary } from '../repo-diagram/symbol-summarizer';
import type { RepoProfile } from '@/lib/types/repo-diagram';

// ─── Blob-SHA Cache Layer ───────────────────────────────────────
// Caches per-file results keyed by content hash (Git blob SHA).
// On a re-diagram after a small commit, only changed files need
// re-parsing; unchanged files are pulled from cache.

const CACHE_TTL_MS = process.env.NODE_ENV === 'development'
  ? 5 * 60 * 1000
  : 30 * 60 * 1000;

const MAX_ENTRIES = 200;

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

class BlobCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private insertionOrder: string[] = [];

  get(blobSha: string): T | null {
    const entry = this.map.get(blobSha);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.map.delete(blobSha);
      const idx = this.insertionOrder.indexOf(blobSha);
      if (idx !== -1) this.insertionOrder.splice(idx, 1);
      return null;
    }
    return entry.value;
  }

  set(blobSha: string, value: T): void {
    if (this.map.size >= MAX_ENTRIES && !this.map.has(blobSha)) {
      const oldest = this.insertionOrder.shift();
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(blobSha, { value, cachedAt: Date.now() });
    if (!this.insertionOrder.includes(blobSha)) {
      this.insertionOrder.push(blobSha);
    }
  }

  has(blobSha: string): boolean {
    return this.get(blobSha) !== null;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
    this.insertionOrder.length = 0;
  }
}

// ─── Singleton caches ───────────────────────────────────────────

const codeGraphCache = new BlobCache<CodeGraph>();
const summaryCache = new BlobCache<CompactFileSummary[]>();
const profileCache = new BlobCache<RepoProfile>();

// ─── Code Graph Cache ───────────────────────────────────────────

export function getCachedCodeGraph(fileShas: string): CodeGraph | null {
  return codeGraphCache.get(fileShas);
}

export function setCachedCodeGraph(fileShas: string, graph: CodeGraph): void {
  codeGraphCache.set(fileShas, graph);
}

// ─── Symbol Summary Cache ───────────────────────────────────────

export function getCachedSummaries(fileShas: string): CompactFileSummary[] | null {
  return summaryCache.get(fileShas);
}

export function setCachedSummaries(fileShas: string, summaries: CompactFileSummary[]): void {
  summaryCache.set(fileShas, summaries);
}

// ─── Profile Cache (per-repo, not per-file) ─────────────────────

export function getCachedProfile(repoUrl: string): RepoProfile | null {
  return profileCache.get(repoUrl);
}

export function setCachedProfile(repoUrl: string, profile: RepoProfile): void {
  profileCache.set(repoUrl, profile);
}

// ─── Composite SHA builder ──────────────────────────────────────
// Build a composite SHA from file blob SHAs to use as cache key
// for results that depend on multiple files.

export function buildCompositeSha(
  fileShas: Array<{ path: string; sha: string }>,
  maxFiles: number = 50
): string {
  const sorted = fileShas
    .slice(0, maxFiles)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}:${f.sha}`)
    .join('|');
  // Simple hash — not cryptographic, just for cache keying
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `composite_${Math.abs(hash).toString(36)}`;
}

// ─── Cache Stats ────────────────────────────────────────────────

export function getBlobCacheStats(): {
  codeGraph: number;
  summaries: number;
  profiles: number;
} {
  return {
    codeGraph: codeGraphCache.size,
    summaries: summaryCache.size,
    profiles: profileCache.size,
  };
}

export function clearBlobCaches(): void {
  codeGraphCache.clear();
  summaryCache.clear();
  profileCache.clear();
}
