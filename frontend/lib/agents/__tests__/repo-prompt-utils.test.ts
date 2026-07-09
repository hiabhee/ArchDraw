import { describe, it, expect } from 'vitest';
import {
  buildArchitectureReviewPrompt,
  compactNodesForReview,
  REVIEW_PROMPT_CHAR_BUDGET,
} from '../repo-prompt-utils';
import type { ExtractedNode, RichEdge, RepoProfile, DependencyIntelligence } from '@/lib/types/repo-diagram';

const profile: RepoProfile = {
  repoType: 'fullstack_monolith',
  architecturePattern: 'monolithic',
  primaryStack: { language: 'TypeScript', framework: 'Next.js', runtime: 'node' },
  applicationDomain: 'Test web application',
  coreCapabilities: ['User authentication', 'Data management'],
  primaryUserFlows: ['User logs in and views dashboard'],
  confidence: 'high',
  reasoning: 'test',
  extractionStrategy: {
    keyDirectories: ['app', 'lib'],
    entryPoints: ['app/page.tsx'],
    moduleStructure: 'app router',
    focusAreas: ['api'],
  },
};

describe('buildArchitectureReviewPrompt', () => {
  it('stays within char budget for large graphs', () => {
    const nodes: ExtractedNode[] = Array.from({ length: 40 }, (_, i) => ({
      id: `node_${i}`,
      label: `Service Component ${i}`,
      type: 'SERVICE',
      description: 'A very long description '.repeat(20),
      sourceFiles: [`app/api/route${i}/route.ts`, `lib/service${i}.ts`, `extra/file${i}.ts`],
      confidence: 'medium',
    }));
    const edges: RichEdge[] = Array.from({ length: 25 }, (_, i) => ({
      from: `node_${i}`,
      to: `node_${i + 1}`,
      type: 'http_call',
      label: 'calls',
      direction: 'sync',
      protocol: 'http',
      dataFlow: '',
      triggeredBy: 'user_action',
      description: 'long edge description '.repeat(10),
      confidence: 'medium',
    }));
    const deps: DependencyIntelligence[] = Array.from({ length: 20 }, (_, i) => ({
      name: `@pkg/service-${i}`,
      category: 'external_api',
      purpose: 'test',
      usedIn: [`file${i}.ts`],
      usagePattern: 'import',
      architecturalRole: 'supporting_infrastructure',
      externalEndpoint: null,
      isOnCriticalPath: false,
    }));

    const prompt = buildArchitectureReviewPrompt(nodes, edges, [], profile, deps);
    expect(prompt.length).toBeLessThanOrEqual(REVIEW_PROMPT_CHAR_BUDGET);
    expect(prompt).not.toContain('very long description');
  });

  it('compactNodesForReview omits descriptions', () => {
    const compact = compactNodesForReview([
      {
        id: 'api',
        label: 'API',
        type: 'API_ROUTE',
        description: 'should not appear',
        sourceFiles: ['a.ts', 'b.ts', 'c.ts'],
        confidence: 'high',
      },
    ]);
    expect(compact[0]).toEqual({
      id: 'api',
      label: 'API',
      type: 'API_ROUTE',
      c: 'high',
      files: ['a.ts', 'b.ts'],
    });
  });
});
