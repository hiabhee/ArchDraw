import type { ArchitectureNode, ArchitectureEdge } from '../types';
import type { DiagramQualityReport } from '../validation/diagramQualityValidator';
import type { PipelineResult } from '@/lib/types/repo-diagram';

const CACHE_TTL_MS = process.env.NODE_ENV === 'development'
  ? 5 * 60 * 1000   // 5 minutes in dev — avoids stale results during iterative fixes
  : 30 * 60 * 1000; // 30 minutes in production
const MAX_CACHE_ENTRIES = 20;

// Bump this string whenever the pipeline logic changes to automatically
// invalidate all cached results without needing a server restart.
const PIPELINE_VERSION = 'v6';

export interface CachedDiagram {
  normalizedPrompt: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  qualityReport: DiagramQualityReport;
  cachedAt: number;
}

// ── Repo diagram cache (keyed by repoUrl + headSha) ──────────

interface CachedRepoDiagram {
  result: PipelineResult;
  repoUrl: string;
  headSha: string;
  cachedAt: number;
}

const repoCache = new Map<string, CachedRepoDiagram>();
const repoInsertionOrder: string[] = [];

function getRepoCacheKey(repoUrl: string, headSha: string): string {
  return `${PIPELINE_VERSION}::${repoUrl}::${headSha}`;
}

function isExpired(ts: number): boolean {
  return Date.now() - ts > CACHE_TTL_MS;
}

function evictOldestRepoEntry(): void {
  while (repoInsertionOrder.length >= MAX_CACHE_ENTRIES && repoInsertionOrder.length > 0) {
    const oldest = repoInsertionOrder.shift();
    if (oldest) repoCache.delete(oldest);
  }
}

export function getRepoDiagram(repoUrl: string, headSha: string): PipelineResult | null {
  const key = getRepoCacheKey(repoUrl, headSha);
  const entry = repoCache.get(key);
  if (!entry) return null;
  if (isExpired(entry.cachedAt)) {
    repoCache.delete(key);
    const idx = repoInsertionOrder.indexOf(key);
    if (idx !== -1) repoInsertionOrder.splice(idx, 1);
    return null;
  }
  return entry.result;
}

export function setRepoDiagram(repoUrl: string, headSha: string, result: PipelineResult): void {
  const key = getRepoCacheKey(repoUrl, headSha);
  if (repoCache.size >= MAX_CACHE_ENTRIES && !repoCache.has(key)) {
    evictOldestRepoEntry();
  }
  repoCache.set(key, { result, repoUrl, headSha, cachedAt: Date.now() });
  if (!repoInsertionOrder.includes(key)) {
    repoInsertionOrder.push(key);
  }
}

// ── Prompt-based diagram cache (existing) ────────────────────

const cache = new Map<string, CachedDiagram>();
const insertionOrder: string[] = [];

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function get(prompt: string): CachedDiagram | null {
  const normalized = normalizePrompt(prompt);
  const entry = cache.get(normalized);

  if (!entry) {
    return null;
  }

  if (isExpired(entry.cachedAt)) {
    cache.delete(normalized);
    const idx = insertionOrder.indexOf(normalized);
    if (idx !== -1) {
      insertionOrder.splice(idx, 1);
    }
    return null;
  }

  return entry;
}

export function set(
  prompt: string,
  diagram: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
    qualityReport: DiagramQualityReport;
  }
): void {
  const normalized = normalizePrompt(prompt);

  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(normalized)) {
    evictOldest();
  }

  const entry: CachedDiagram = {
    normalizedPrompt: normalized,
    nodes: diagram.nodes,
    edges: diagram.edges,
    qualityReport: diagram.qualityReport,
    cachedAt: Date.now(),
  };

  cache.set(normalized, entry);

  if (!insertionOrder.includes(normalized)) {
    insertionOrder.push(normalized);
  }
}

export function clear(): void {
  cache.clear();
  insertionOrder.length = 0;
  repoCache.clear();
  repoInsertionOrder.length = 0;
}

// Helper for old-style eviction (used by both caches)
function evictOldest(): void {
  while (insertionOrder.length >= MAX_CACHE_ENTRIES && insertionOrder.length > 0) {
    const oldest = insertionOrder.shift();
    if (oldest) {
      cache.delete(oldest);
    }
  }
}
