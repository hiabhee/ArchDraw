import { describe, it, expect } from 'vitest';
import {
  getCachedCodeGraph,
  setCachedCodeGraph,
  getCachedSummaries,
  setCachedSummaries,
  getCachedProfile,
  setCachedProfile,
  buildCompositeSha,
  getBlobCacheStats,
  clearBlobCaches,
} from '../blobCache';
import type { CodeGraph } from '../../repo-diagram/code-graph';
import type { CompactFileSummary } from '../../repo-diagram/symbol-summarizer';
import type { RepoProfile } from '../../types/repo-diagram';

// Helper to create a mock CodeGraph
function mockGraph(): CodeGraph {
  return { importGraph: [], apiCalls: [], fileSummaries: new Map() };
}

describe('blobCache', () => {
  describe('buildCompositeSha', () => {
    it('returns same hash for same inputs regardless of order', () => {
      const a = [{ path: 'a.ts', sha: 'abc' }, { path: 'b.ts', sha: 'def' }];
      const b = [{ path: 'b.ts', sha: 'def' }, { path: 'a.ts', sha: 'abc' }];
      expect(buildCompositeSha(a)).toBe(buildCompositeSha(b));
    });

    it('returns different hash for different inputs', () => {
      const a = [{ path: 'a.ts', sha: 'abc' }];
      const b = [{ path: 'a.ts', sha: 'xyz' }];
      expect(buildCompositeSha(a)).not.toBe(buildCompositeSha(b));
    });

    it('returns different hash for different file sets', () => {
      const a = [{ path: 'a.ts', sha: 'abc' }];
      const b = [{ path: 'a.ts', sha: 'abc' }, { path: 'c.ts', sha: 'ghi' }];
      expect(buildCompositeSha(a)).not.toBe(buildCompositeSha(b));
    });

    it('handles empty input', () => {
      const hash = buildCompositeSha([]);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('respects maxFiles parameter', () => {
      const files = Array.from({ length: 100 }, (_, i) => ({ path: `${i}.ts`, sha: `sha${i}` }));
      const hash1 = buildCompositeSha(files, 10);
      const hash2 = buildCompositeSha(files, 20);
      // Both truncated to maxFiles, but different truncation => different hashes
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('code graph cache', () => {
    it('round-trips a code graph', () => {
      clearBlobCaches();
      const graph = mockGraph();
      setCachedCodeGraph('sha-1', graph);
      expect(getCachedCodeGraph('sha-1')).toBe(graph);
      clearBlobCaches();
    });

    it('returns null for missing keys', () => {
      clearBlobCaches();
      expect(getCachedCodeGraph('missing-key')).toBeNull();
      clearBlobCaches();
    });

    it('overwrites existing entry', () => {
      clearBlobCaches();
      const g1 = mockGraph();
      const g2 = mockGraph();
      setCachedCodeGraph('sha-1', g1);
      setCachedCodeGraph('sha-1', g2);
      expect(getCachedCodeGraph('sha-1')).toBe(g2);
      clearBlobCaches();
    });
  });

  describe('summary cache', () => {
    it('round-trips summaries', () => {
      clearBlobCaches();
      const summaries: CompactFileSummary[] = [
        { path: 'a.ts', line: 'a.ts :: exports foo', exports: ['foo'], apiCalls: [], jsxComponents: [] },
      ];
      setCachedSummaries('sha-2', summaries);
      expect(getCachedSummaries('sha-2')).toBe(summaries);
      clearBlobCaches();
    });

    it('returns null for missing keys', () => {
      clearBlobCaches();
      expect(getCachedSummaries('missing-key')).toBeNull();
      clearBlobCaches();
    });
  });

  describe('profile cache', () => {
    it('round-trips a profile', () => {
      clearBlobCaches();
      const profile = {
        repoType: 'fullstack_monolith',
        architecturePattern: 'layered',
        primaryStack: { framework: 'Next.js', language: 'TypeScript', runtime: 'Node.js' },
        applicationDomain: 'Application',
        coreCapabilities: [],
        primaryUserFlows: [],
        confidence: 'high',
        reasoning: 'test',
        extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] },
      } as RepoProfile;
      setCachedProfile('repo-url-1', profile);
      expect(getCachedProfile('repo-url-1')).toBe(profile);
      expect(getCachedProfile('missing-url')).toBeNull();
      clearBlobCaches();
    });
  });

  describe('cache stats', () => {
    it('reports correct counts', () => {
      clearBlobCaches();
      setCachedCodeGraph('s1', mockGraph());
      setCachedCodeGraph('s2', mockGraph());
      setCachedSummaries('s3', []);
      const stats = getBlobCacheStats();
      expect(stats.codeGraph).toBe(2);
      expect(stats.summaries).toBe(1);
      expect(stats.profiles).toBe(0);
      clearBlobCaches();
    });
  });

  describe('clearBlobCaches', () => {
    it('empties all caches', () => {
      setCachedCodeGraph('s1', mockGraph());
      setCachedSummaries('s2', []);
      clearBlobCaches();
      const stats = getBlobCacheStats();
      expect(stats.codeGraph).toBe(0);
      expect(stats.summaries).toBe(0);
      expect(stats.profiles).toBe(0);
    });
  });
});
