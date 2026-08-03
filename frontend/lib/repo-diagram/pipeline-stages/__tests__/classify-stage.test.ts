import { describe, it, expect } from 'vitest';
import { ClassifyStage } from '../ClassifyStage';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { EnrichmentInput } from '../enrichment-types';
import type { RepoSnapshot, Subsystem, StaticSignal } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';

function minimalSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repoUrl: 'https://github.com/acme/demo',
    owner: 'acme',
    repo: 'demo',
    fileTree: [],
    selectedFiles: [],
    phase1Files: [],
    phase2Files: [],
    repoMeta: {
      hasAppDir: false,
      hasPagesDir: false,
      hasPrisma: false,
      hasMiddleware: false,
      hasEnvExample: false,
      packageJson: null,
    },
    surfaceClassification: { primaryLanguage: 'ts' } as RepoSnapshot['surfaceClassification'],
    ...overrides,
  };
}

function baseInput(overrides: Partial<EnrichmentInput> = {}): EnrichmentInput {
  const snapshot = minimalSnapshot();
  return {
    snapshot,
    subsystems: [] as Subsystem[],
    signals: [] as StaticSignal[],
    importGraph: { edges: new Map(), external: new Set() } as ImportGraph,
    baselineNodes: [],
    baselineEdges: [],
    workflows: [],
    ...overrides,
  };
}

describe('ClassifyStage', () => {
  it('skips LLM enrichment for detailLevel=1 (static-only)', async () => {
    const stage = new ClassifyStage();
    const ctx = new DefaultPipelineContext('test', { detailLevel: 1 });
    const result = await stage.execute(baseInput({ detailLevel: 1 }), ctx);

    expect(result.success).toBe(true);
    expect(result.data!.useLlm).toBe(false);
    expect(result.data!.repoProfile).toBeNull();
    expect(result.data!.workingNodes).toEqual([]);
  });

  it('does not mutate the input snapshot object', async () => {
    const stage = new ClassifyStage();
    const snapshot = minimalSnapshot({
      selectedFiles: [{ path: 'a.ts', content: 'x', size: 1 } as RepoSnapshot['selectedFiles'][number]],
      phase2Files: [{ path: 'a.ts', content: 'x', size: 1 } as RepoSnapshot['phase2Files'][number]],
    });
    const selectedBefore = snapshot.selectedFiles;
    const ctx = new DefaultPipelineContext('test', { detailLevel: 1 });
    await stage.execute(baseInput({ snapshot, detailLevel: 1 }), ctx);
    expect(snapshot.selectedFiles).toBe(selectedBefore);
  });
});
