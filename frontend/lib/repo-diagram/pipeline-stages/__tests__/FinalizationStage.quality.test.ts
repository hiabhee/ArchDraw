import { describe, expect, it } from 'vitest';
import { assessRepoDiagramQuality } from '../FinalizationStage';
import type { DegradedFlags, ExtractedNode, RichEdge, RepoProfile } from '@/lib/types/repo-diagram';

const nodes: ExtractedNode[] = [
  { id: 'app', label: 'App', type: 'SERVICE', description: '', sourceFiles: ['src/app.ts'], confidence: 'high' },
  { id: 'db', label: 'Database', type: 'DATABASE', description: '', sourceFiles: ['src/db.ts'], confidence: 'high' },
];
const edges: RichEdge[] = [{ from: 'app', to: 'db', type: 'db_query', label: 'stores data', direction: 'sync', protocol: 'db', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: 'high' }];
const clean: DegradedFlags = { classify: false, extract: false, edges: false, ingestion: false, anything: false };
const profile = (repoType: RepoProfile['repoType']): RepoProfile => ({
  repoType, architecturePattern: 'monolithic', primaryStack: { framework: null, language: 'TypeScript', runtime: 'node' },
  applicationDomain: '', coreCapabilities: [], primaryUserFlows: [], confidence: 'high', reasoning: '',
  extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] },
});

describe('repo diagram quality gate', () => {
  it('allows a structurally sound deterministic fallback', () => {
    expect(assessRepoDiagramQuality({ nodes, edges, repoProfile: profile('backend_only'), groundedNodeRatio: 1, useLlm: true, degraded: { ...clean, extract: true, anything: true } }))
      .toBeNull();
  });

  it('rejects a sparse full-stack graph', () => {
    expect(assessRepoDiagramQuality({ nodes, edges, repoProfile: profile('fullstack_monolith'), groundedNodeRatio: 1, useLlm: true, degraded: clean }))
      .toContain('requires at least 4 components and 3 relationships');
  });

  it('allows a grounded library graph without relationships', () => {
    expect(assessRepoDiagramQuality({ nodes: nodes.slice(0, 1), edges: [], repoProfile: profile('library'), groundedNodeRatio: 1, useLlm: true, degraded: clean }))
      .toBeNull();
  });

  it('allows an explicitly requested static scan', () => {
    expect(assessRepoDiagramQuality({ nodes: [], edges: [], repoProfile: null, groundedNodeRatio: 0, useLlm: false, degraded: clean }))
      .toBeNull();
  });
});
