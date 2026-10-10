import { describe, expect, it } from 'vitest';
import { addComposeArchitecture, addExternalSdkEvidenceEdges, addQueryEvidenceEdges, shouldExpandRoot } from '../BaselineStage';
import type { ExtractedNode, StaticSignal, RepoSnapshot } from '@/lib/types/repo-diagram';

const signals: StaticSignal[] = [
  { type: 'docker_service', label: 'api', source: 'docker-compose.yml', details: {}, confidence: 'high' },
  { type: 'docker_service', label: 'postgres', source: 'docker-compose.yml', details: {}, confidence: 'high' },
  { type: 'docker_service', label: 'redis', source: 'docker-compose.yml', details: {}, confidence: 'high' },
  { type: 'compose_dependency', label: 'postgres', source: 'docker-compose.yml', details: { from: 'api', to: 'postgres' }, confidence: 'high' },
  { type: 'compose_dependency', label: 'redis', source: 'docker-compose.yml', details: { from: 'api', to: 'redis' }, confidence: 'high' },
];

describe('Compose baseline', () => {
  it('creates grounded service nodes and depends_on edges', () => {
    const graph = addComposeArchitecture([], [], signals);
    expect(graph.nodes.map(node => [node.id, node.type])).toEqual([
      ['compose_api', 'SERVICE'],
      ['compose_postgres', 'DATABASE'],
      ['compose_redis', 'CACHE'],
    ]);
    expect(graph.edges.map(edge => `${edge.from}->${edge.to}`)).toEqual([
      'compose_api->compose_postgres',
      'compose_api->compose_redis',
    ]);
    expect(graph.edges.every(edge => edge.confidence === 'high')).toBe(true);
  });
});

describe('root expansion guard', () => {
  const snapshot = (fileTree: string[]): RepoSnapshot => ({
    repoUrl: 'https://github.com/test/repo', owner: 'test', repo: 'repo', fileTree,
    selectedFiles: [], failedPaths: [], phase1Files: [], phase2Files: [],
    repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: null },
    surfaceClassification: { primaryLanguage: 'JavaScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
  });

  it('does not split a library into directory pseudo-layers', () => {
    expect(shouldExpandRoot(snapshot(['lib/index.js', 'lib/router.js', 'lib/application.js', 'test/app.js']))).toBe(false);
  });

  it('expands an application with explicit route layers', () => {
    expect(shouldExpandRoot(snapshot(['src/routes/index.ts', 'src/services/users.ts', 'src/db/client.ts']))).toBe(true);
  });
});

describe('query-evidence baseline', () => {
  it('connects an API route to a single detected datastore', () => {
    const nodes: ExtractedNode[] = [
      { id: 'api_root', label: 'Application API', type: 'API_ROUTE', description: '', sourceFiles: ['main.py'], confidence: 'high' },
      { id: 'database', label: 'Database', type: 'DATABASE', description: '', sourceFiles: ['schema.sql'], confidence: 'high' },
    ];
    const edges = addQueryEvidenceEdges(nodes, [], [{ type: 'db_query', label: 'sql_query_main', source: 'main.py', details: {}, confidence: 'high' }]);
    expect(edges).toMatchObject([{ from: 'api_root', to: 'database', type: 'db_query', confidence: 'high' }]);
  });

  it('does not guess between multiple datastores', () => {
    const nodes: ExtractedNode[] = [
      { id: 'api_root', label: 'Application API', type: 'API_ROUTE', description: '', sourceFiles: ['main.py'], confidence: 'high' },
      { id: 'primary', label: 'Primary DB', type: 'DATABASE', description: '', sourceFiles: [], confidence: 'high' },
      { id: 'cache', label: 'Cache', type: 'CACHE', description: '', sourceFiles: [], confidence: 'high' },
    ];
    expect(addQueryEvidenceEdges(nodes, [], [{ type: 'db_query', label: 'sql_query_main', source: 'main.py', details: {}, confidence: 'high' }])).toEqual([]);
  });
});

describe('external SDK evidence baseline', () => {
  it('connects an API route to an SDK boundary from the same source file', () => {
    const nodes: ExtractedNode[] = [
      { id: 'checkout', label: 'Checkout API', type: 'API_ROUTE', description: '', sourceFiles: ['app/api/checkout/route.ts'], confidence: 'high' },
      { id: 'external_stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', description: '', sourceFiles: ['app/api/checkout/route.ts'], confidence: 'medium' },
    ];
    const edges = addExternalSdkEvidenceEdges(nodes, [], [
      { type: 'sdk_usage', label: 'Stripe', source: 'app/api/checkout/route.ts', details: { category: 'payments' }, confidence: 'medium' },
    ]);
    expect(edges).toMatchObject([{ from: 'checkout', to: 'external_stripe', type: 'external_call', confidence: 'high' }]);
  });
});
