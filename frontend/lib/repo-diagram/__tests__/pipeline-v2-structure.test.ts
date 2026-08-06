import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from '@/lib/pipeline-core/Pipeline';
import { successResult } from '@/lib/pipeline-core/StageResult';
import { createRepoDiagramStages } from '../pipeline-v2';
import type { PipelineResult as RepoPipelineResult } from '@/lib/types/repo-diagram';
import type { IngestionOutput } from '../pipeline-stages/IngestionStage';

describe('repo-pipeline-v2 structure', () => {
  it('registers a flat stage list without a mega-orchestrator', () => {
    const stages = createRepoDiagramStages();
    const names = stages.map(s => s.name);

    expect(names).toEqual([
      'ingesting',
      'cache-check',
      'analysis',
      'baseline',
      'classifying',
      'extracting_components',
      'analyzing_relationships',
      'verifying',
      'finalization',
      'cache-write',
    ]);
    expect(names).not.toContain('orchestrator');
    expect(names).not.toContain('llm-processing');
  });
});

describe('repo-pipeline-v2 cache terminal path', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('stops after cache-check on hit and skips later stages', async () => {
    const cached: RepoPipelineResult = {
      ndjson: '{"nodes":[],"edges":[]}',
      nodeCount: 0,
      edgeCount: 0,
      workflowCount: 0,
      workflows: [],
      repoMeta: {
        hasAppDir: false,
        hasPagesDir: false,
        hasPrisma: false,
        hasMiddleware: false,
        hasEnvExample: false,
        packageJson: null,
      },
      repoProfile: {
        repoType: 'unknown',
        architecturePattern: 'unknown',
        primaryStack: { framework: null, language: 'ts', runtime: '' },
        applicationDomain: '',
        coreCapabilities: [],
        primaryUserFlows: [],
        confidence: 'low',
        reasoning: 'cache',
        extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] },
      },
      dependencyMap: [],
      reviewNotes: '',
      confidence: 'medium',
      nodes: [],
      edges: [],
      degraded: { classify: false, extract: false, edges: false, ingestion: false, anything: false },
      diagnostics: { groundedNodeRatio: 1, evidencedEdgeRatio: 1, truncatedNodes: [], failedPaths: [] },
    };

    const ingestOut: IngestionOutput = {
      snapshot: {
        repoUrl: 'https://github.com/acme/demo',
        owner: 'acme',
        repo: 'demo',
        headSha: 'abc1234deadbeef',
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
        surfaceClassification: { primaryLanguage: 'ts' } as IngestionOutput['snapshot']['surfaceClassification'],
      },
      FILE_BUDGETS: { 1: 500, 2: 1000, 3: 2000 },
    };

    const pipeline = new Pipeline('cache-terminal-test', [
      {
        name: 'ingesting',
        async execute() {
          return successResult(ingestOut);
        },
      },
      {
        name: 'cache-check',
        async execute() {
          return successResult(cached, ['Cache hit'], { terminal: true });
        },
      },
      {
        name: 'analysis',
        async execute() {
          throw new Error('analysis should not run after cache hit');
        },
      },
      {
        name: 'baseline',
        async execute() {
          throw new Error('baseline should not run after cache hit');
        },
      },
    ]);

    const result = await pipeline.execute({ repoUrl: 'https://github.com/acme/demo', detailLevel: 2 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(cached);
    expect(result.metrics.stagesExecuted).toBe(2);
    expect(result.stageResults.map(s => s.stage)).toEqual(['ingesting', 'cache-check']);
  });
});
