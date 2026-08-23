import { describe, it, expect } from 'vitest';
import { verifyGraph } from '../repo-verifier';
import type { ExtractedNode, RichEdge, StaticSignal } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';

function node(id: string, label: string, type: string, sourceFiles: string[], confidence: 'high' | 'medium' | 'low'): ExtractedNode {
  return { id, label, type: type as ExtractedNode['type'], description: '', sourceFiles, confidence };
}
function edge(from: string, to: string, type = 'http_call', conf: 'high' | 'medium' | 'low' = 'medium'): RichEdge {
  return { from, to, type, label: 'calls', direction: 'sync', protocol: 'http', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: conf };
}

describe('verifyGraph (Phase 6.4)', () => {
  it('drops hallucinated sourceFiles that are not in the fileTree', () => {
    const out = verifyGraph({
      nodes: [node('api', 'Order API', 'API_ROUTE', ['app/api/route.ts', 'app/api/__phantom__.ts'], 'high')],
      edges: [],
      signals: [],
      fileTree: ['app/api/route.ts'],
    });
    expect(out.nodes[0].sourceFiles).toEqual(['app/api/route.ts']);
    expect(out.stats.droppedSourceFiles).toBe(1);
  });

  it('drops a low-confidence node with zero real sourceFiles AND no signal support', () => {
    const out = verifyGraph({
      nodes: [node('x', 'Phantom', 'SERVICE', ['nonexistent.ts'], 'low')],
      edges: [],
      signals: [],
      fileTree: [],
    });
    expect(out.nodes).toHaveLength(0);
    expect(out.stats.droppedNodes).toBe(1);
  });

  it('keeps a low-confidence node if it has signal support (e.g. a route file)', () => {
    const signals: StaticSignal[] = [{ type: 'route', label: 'route.ts', source: 'routes/x.ts', details: {}, confidence: 'high' }];
    const out = verifyGraph({
      nodes: [node('x', 'Phantom', 'API_ROUTE', ['routes/x.ts'], 'low')],
      edges: [],
      signals,
      fileTree: ['routes/x.ts'],
    });
    expect(out.nodes).toHaveLength(1);
  });

  it('promotes import-evidence edges to high confidence', () => {
    const graph: ImportGraph = {
      edges: new Map([['app/api/route.ts', new Set(['lib/db.ts'])]]),
      external: new Map(),
      unresolved: new Map(),
    };
    const out = verifyGraph({
      nodes: [node('api', 'Order API', 'API_ROUTE', ['app/api/route.ts'], 'high'), node('db', 'DB', 'DATABASE', ['lib/db.ts'], 'high')],
      edges: [edge('api', 'db', 'http_call', 'medium')],
      signals: [],
      fileTree: ['app/api/route.ts', 'lib/db.ts'],
      importGraph: graph,
    });
    expect(out.edges[0].confidence).toBe('high');
    expect(out.stats.edgesCorroborated).toBe(1);
  });

  it('caps ungrounded edges to low (never deletes)', () => {
    const out = verifyGraph({
      nodes: [node('a', 'A', 'SERVICE', ['a.ts'], 'high'), node('b', 'B', 'DATABASE', ['b.ts'], 'high')],
      edges: [edge('a', 'b', 'http_call', 'high')],
      signals: [],
      fileTree: ['a.ts', 'b.ts'],
    });
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].confidence).toBe('low');
    expect(out.stats.edgesCappedToLow).toBe(1);
  });

  it('deletes unevidenced already-low edges (pure speculation)', () => {
    const out = verifyGraph({
      nodes: [node('a', 'A', 'SERVICE', ['a.ts'], 'high'), node('b', 'B', 'DATABASE', ['b.ts'], 'high')],
      edges: [{ ...edge('a', 'b', 'http_call', 'low'), label: 'streams events' }],
      signals: [],
      fileTree: ['a.ts', 'b.ts'],
    });
    expect(out.edges).toHaveLength(0);
    expect(out.stats.edgesDropped).toBe(1);
  });

  it('keeps unevidenced "(assumed)" baseline guesses even at low confidence', () => {
    const out = verifyGraph({
      nodes: [node('a', 'A', 'SERVICE', ['a.ts'], 'high'), node('b', 'B', 'DATABASE', ['b.ts'], 'high')],
      edges: [{ ...edge('a', 'b', 'http_call', 'low'), label: 'calls (assumed)' }],
      signals: [],
      fileTree: ['a.ts', 'b.ts'],
    });
    expect(out.edges).toHaveLength(1);
    expect(out.stats.edgesDropped).toBe(0);
  });

  it('drops edges whose endpoints were removed by node cleanup', () => {
    const out = verifyGraph({
      nodes: [node('a', 'A', 'SERVICE', ['nonexistent.ts'], 'low')],
      edges: [edge('a', 'b', 'http_call', 'high')],
      signals: [],
      fileTree: [],
    });
    expect(out.nodes).toHaveLength(0);
    expect(out.edges).toHaveLength(0);
  });

  it('maps compose_dependency signals to node-id pairs (label slug match)', () => {
    const signals: StaticSignal[] = [
      { type: 'compose_dependency', label: 'postgres', source: 'docker-compose.yml', details: { from: 'api', to: 'postgres', kind: 'depends_on' }, confidence: 'high' },
    ];
    const out = verifyGraph({
      nodes: [
        node('api', 'API', 'API_ROUTE', ['app/api/route.ts'], 'high'),
        node('postgres', 'PostgreSQL', 'DATABASE', [], 'high'),
      ],
      edges: [edge('api', 'postgres', 'depends_on', 'medium')],
      signals,
      fileTree: ['app/api/route.ts'],
    });
    expect(out.edges[0].confidence).toBe('high');
    expect(out.stats.edgesCorroborated).toBe(1);
  });

  it('keeps isolated nodes with grounded sourceFiles even when confidence is medium', () => {
    const out = verifyGraph({
      nodes: [node('api', 'API', 'API_ROUTE', ['app/api/route.ts'], 'medium')],
      edges: [],
      signals: [],
      fileTree: ['app/api/route.ts'],
    });
    expect(out.nodes).toHaveLength(1);
  });
});