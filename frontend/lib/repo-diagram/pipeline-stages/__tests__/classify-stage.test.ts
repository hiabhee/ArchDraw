import { describe, it, expect } from 'vitest';
import { ClassifyStage } from '../ClassifyStage';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { EnrichmentInput } from '../enrichment-types';
import type { RepoSnapshot, Subsystem, StaticSignal } from '@/lib/types/repo-diagram';
import { buildFallbackRepoProfile } from '@/lib/agents/repo-deep-classifier';

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
    importGraph: { edges: new Map(), external: new Map(), unresolved: new Map() },
    baselineNodes: [],
    baselineEdges: [],
    workflows: [],
    ...overrides,
  };
}

describe('ClassifyStage', () => {
  it('classifies configuration-only Compose repositories as devops', () => {
    const profile = buildFallbackRepoProfile(minimalSnapshot({
      fileTree: ['docker-compose.yml', 'infra/main.tf', 'README.md'],
      surfaceClassification: { primaryLanguage: 'Unknown', detectedFrameworks: [], hasDocker: true, hasMultipleServices: true, isMonorepo: false, projectType: 'unknown' },
    }));
    expect(profile.repoType).toBe('devops_config');
    expect(profile.architecturePattern).toBe('pipeline');
  });

  it('classifies a package-named Express framework as a library', () => {
    const profile = buildFallbackRepoProfile(minimalSnapshot({
      fileTree: ['index.js', 'lib/express.js', 'package.json'],
      repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: { name: 'express' } },
      surfaceClassification: { primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: ['Express'], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    }));
    expect(profile.repoType).toBe('library');
  });

  it('classifies a repository named after its Python framework as a library', () => {
    const profile = buildFallbackRepoProfile(minimalSnapshot({
      repo: 'fastapi',
      fileTree: ['fastapi/applications.py', 'pyproject.toml'],
      phase1Files: [{ path: 'pyproject.toml', content: '[project]\nname = "fastapi"\ndependencies = ["fastapi"]' }],
      surfaceClassification: { primaryLanguage: 'Python', detectedFrameworks: ['FastAPI'], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    }));
    expect(profile.repoType).toBe('library');
  });

  it('skips LLM enrichment for detailLevel=1 (static-only)', async () => {
    const stage = new ClassifyStage();
    const ctx = new DefaultPipelineContext('test', { detailLevel: 1 });
    const result = await stage.execute(baseInput({ detailLevel: 1 }), ctx);

    expect(result.success).toBe(true);
    expect(result.data!.useLlm).toBe(false);
    expect(result.data!.repoProfile?.repoType).toBe('unknown');
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
