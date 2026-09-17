import { describe, expect, it } from 'vitest';
import { buildClassifierPrompt } from './repo-classifier';
import type { RepoSnapshot } from '@/lib/types/repo-diagram';

function snapshotWithLargeReadme(): RepoSnapshot {
  return {
    owner: 'example', repo: 'large-readme', defaultBranch: 'main', commitSha: 'abc',
    fileTree: Array.from({ length: 1500 }, (_, i) => `src/module-${i}.ts`),
    phase1Files: [{ path: 'README.md', content: 'R'.repeat(60_000) }],
    phase2Files: [{ path: 'src/main.ts', content: 'S'.repeat(60_000) }],
    selectedFiles: [], metaFiles: [], archiveMap: new Map(), failedPaths: [], treeTruncated: false,
    repoMeta: { hasPrisma: false },
    surfaceClassification: { primaryLanguage: 'TypeScript', detectedFrameworks: [] },
  } as unknown as RepoSnapshot;
}

describe('buildClassifierPrompt', () => {
  it('keeps a large README within the complete prompt budget', () => {
    const cap = 20_000;
    const prompt = buildClassifierPrompt(snapshotWithLargeReadme(), 'static report', ['summary'], cap);

    expect(prompt.length).toBeLessThanOrEqual(cap);
    expect(prompt).toContain('README CONTEXT');
    expect(prompt).toContain('[README truncated to fit token budget]');
  });
});
