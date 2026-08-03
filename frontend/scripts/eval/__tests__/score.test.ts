import { describe, it, expect } from 'vitest';
import {
  normalizeId,
  labelTokens,
  overlapCoefficient,
  nodeMatches,
  matchNodes,
  matchEdges,
  scoreClassification,
  normalizeDatabase,
  scoreRepo,
  aggregateScores,
} from '../score';
import type { GoldenGraph, PredictedGraph } from '../types';

describe('normalizeId', () => {
  it('lowercases and slugifies', () => {
    expect(normalizeId('Order_API!')).toBe('order_api');
    expect(normalizeId('PostgreSQL DB')).toBe('postgresql_db');
    expect(normalizeId('___')).toBe('node');
  });
});

describe('labelTokens + overlapCoefficient', () => {
  it('strips generic type words so "Order API" ≈ "Orders API Route"', () => {
    const a = labelTokens('Order API');
    const b = labelTokens('Orders API Route');
    expect(overlapCoefficient(a, b)).toBeGreaterThanOrEqual(0.7);
  });
  it('does not conflate unrelated labels', () => {
    const a = labelTokens('Stripe Webhook');
    const b = labelTokens('PostgreSQL');
    expect(overlapCoefficient(a, b)).toBe(0);
  });
});

describe('nodeMatches', () => {
  it('matches by normalized id', () => {
    expect(nodeMatches({ id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', sourceFiles: [] }, { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE' })).toBe(true);
  });
  it('matches by type-aware label similarity with plurals', () => {
    expect(nodeMatches({ id: 'order_api', label: 'Order API', type: 'API_ROUTE', sourceFiles: [] }, { id: 'order_api', label: 'Orders API', type: 'API_ROUTE', aliases: ['orders api'] })).toBe(true);
  });
  it('matches "PostgreSQL" predicted vs "postgreSQL" golden via id-tokens', () => {
    expect(nodeMatches({ id: 'db', label: 'PostgreSQL', type: 'DATABASE', sourceFiles: [] }, { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE' })).toBe(true);
  });
  it('does NOT match across incompatible families by label alone', () => {
    expect(nodeMatches({ id: 'x', label: 'Auth Service', type: 'AUTH', sourceFiles: [] }, { id: 'db', label: 'PostgreSQL', type: 'DATABASE' })).toBe(false);
  });
  it('matches by >50% source-file overlap', () => {
    expect(nodeMatches(
      { id: 'svc', label: 'Orders', type: 'SERVICE', sourceFiles: ['src/orders/a.ts', 'src/orders/b.ts', 'src/orders/c.ts'] },
      { id: 'order_svc', label: 'Order Service', type: 'SERVICE', sourceFiles: ['src/orders/a.ts', 'src/orders/b.ts'] },
    )).toBe(true);
  });
});

describe('matchNodes (precision/recall + forbidden)', () => {
  const golden = [
    { id: 'web', label: 'Web Frontend', type: 'PAGE' },
    { id: 'api', label: 'Order API', type: 'API_ROUTE', aliases: ['orders api'] },
    { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE' },
  ];
  it('scores full recall + full precision when all real', () => {
    const predicted = [
      { id: 'web_frontend', label: 'Web Frontend', type: 'PAGE', sourceFiles: [] },
      { id: 'order_api', label: 'Order API', type: 'API_ROUTE', sourceFiles: [] },
      { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', sourceFiles: [] },
    ];
    const r = matchNodes(predicted, golden, []);
    expect(r.recall).toBe(1);
    expect(r.precision).toBe(1);
    expect(r.forbiddenViolations).toHaveLength(0);
  });
  it('penalizes an unmatched hallucinated node (precision)', () => {
    const predicted = [
      { id: 'web', label: 'Web Frontend', type: 'PAGE', sourceFiles: [] },
      { id: 'api', label: 'Order API', type: 'API_ROUTE', sourceFiles: [] },
      { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', sourceFiles: [] },
      { id: 'stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', sourceFiles: [] },
    ];
    const r = matchNodes(predicted, golden, []);
    expect(r.recall).toBe(1);
    expect(r.precision).toBeCloseTo(3 / 4, 5);
  });
  it('flags forbidden nodes as hallucination violations', () => {
    const predicted = [
      { id: 'web', label: 'Web Frontend', type: 'PAGE', sourceFiles: [] },
      { id: 'stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', sourceFiles: [] },
    ];
    const r = matchNodes(predicted, golden, ['Stripe']);
    expect(r.forbiddenViolations).toHaveLength(1);
    expect(r.forbiddenViolations[0].label).toBe('Stripe');
  });
  it('returns empty-graph precision = 1 when golden empty', () => {
    const r = matchNodes([], [], []);
    expect(r.recall).toBe(1);
    expect(r.precision).toBe(1);
  });
});

describe('matchEdges (directional, node-mapped)', () => {
  const golden = [
    { from: 'web', to: 'api' },
    { from: 'api', to: 'db' },
  ];
  it('counts matched edges with correct direction only', () => {
    const nodeMapping = new Map([
      ['web', 'web_p'], ['api', 'api_p'], ['db', 'db_p'],
    ]);
    const predicted = [
      { from: 'web_p', to: 'api_p' },
      { from: 'api_p', to: 'db_p' },
    ];
    const r = matchEdges(predicted, golden, nodeMapping);
    expect(r.recall).toBe(1);
    expect(r.precision).toBe(1);
  });
  it('rejects reversed direction', () => {
    const nodeMapping = new Map([['web', 'web_p'], ['api', 'api_p'], ['db', 'db_p']]);
    const predicted = [{ from: 'api_p', to: 'web_p' }];
    const r = matchEdges(predicted, golden, nodeMapping);
    expect(r.recall).toBe(0);
    expect(r.precision).toBe(0);
  });
  it('corroborates evidence edges for precision even if not in golden', () => {
    const nodeMapping = new Map([['web', 'web_p'], ['api', 'api_p']]);
    const predicted = [
      { from: 'web_p', to: 'api_p' },
      { from: 'api_p', to: 'web_p' }, // not golden, not evidence
    ];
    const evidence = new Set(['api_p->web_p']);
    const r = matchEdges(predicted, [{ from: 'web', to: 'api' }], nodeMapping, evidence);
    expect(r.recall).toBe(1);
    // both predicted edges are corroborated (one golden, one evidence) → precision 1
    expect(r.precision).toBe(1);
  });
});

describe('normalizeDatabase', () => {
  it('canonicalizes aliases', () => {
    expect(normalizeDatabase('PostgreSQL')).toBe('postgres');
    expect(normalizeDatabase('pg')).toBe('postgres');
    expect(normalizeDatabase('psycopg2')).toBe('postgres');
    expect(normalizeDatabase('MongoDB')).toBe('mongo');
    expect(normalizeDatabase('MySQL')).toBe('mysql');
    expect(normalizeDatabase('Redis')).toBe('redis');
  });
});

describe('scoreClassification', () => {
  it('scores exact repoType + framework + database', () => {
    expect(scoreClassification(
      { repoType: 'library', framework: 'Express', database: null },
      { repoType: 'library', framework: 'Express', database: null },
    ).accuracy).toBe(1);
  });
  it('fuzzy-matches framework versions (Next.js 14 ≈ Next.js)', () => {
    const r = scoreClassification(
      { repoType: 'fullstack_monolith', framework: 'Next.js 14', database: 'PostgreSQL' },
      { repoType: 'fullstack_monolith', framework: 'Next.js', database: 'PostgreSQL' },
    );
    expect(r.framework).toBe(true);
    expect(r.database).toBe(true);
    expect(r.accuracy).toBe(1);
  });
  it('treats both-null database as a match', () => {
    expect(scoreClassification(
      { repoType: 'library', framework: 'Flask', database: null },
      { repoType: 'library', framework: 'Flask', database: null },
    ).database).toBe(true);
  });
  it('penalizes wrong database', () => {
    expect(scoreClassification(
      { repoType: 'fullstack_monolith', framework: 'Next.js', database: 'MySQL' },
      { repoType: 'fullstack_monolith', framework: 'Next.js', database: 'PostgreSQL' },
    ).database).toBe(false);
  });
});

describe('scoreRepo + aggregateScores', () => {
  const golden: GoldenGraph = {
    repo: 'https://github.com/owner/repo',
    classification: { repoType: 'library', framework: 'Express', database: null },
    nodes: [{ id: 'express_core', label: 'Express', type: 'CORE_MODULE' }],
    edges: [],
    forbiddenNodes: ['PostgreSQL', 'Redis'],
  };
  it('scores a clean library run at 100 with zero forbidden', () => {
    const predicted: PredictedGraph = {
      classification: { repoType: 'library', framework: 'Express', database: null },
      nodes: [{ id: 'express_core', label: 'Express', type: 'CORE_MODULE', sourceFiles: [] }],
      edges: [],
    };
    const s = scoreRepo({ repoId: 'x', url: '', predicted, golden });
    expect(s.composite).toBe(1);
    expect(s.forbiddenViolations).toBe(0);
  });
  it('flags a forbidden hallucination and drops composite', () => {
    const predicted: PredictedGraph = {
      classification: { repoType: 'library', framework: 'Express', database: null },
      nodes: [
        { id: 'express_core', label: 'Express', type: 'CORE_MODULE', sourceFiles: [] },
        { id: 'db', label: 'PostgreSQL', type: 'DATABASE', sourceFiles: [] },
      ],
      edges: [],
    };
    const s = scoreRepo({ repoId: 'x', url: '', predicted, golden });
    expect(s.forbiddenViolations).toBe(1);
    expect(s.composite).toBeLessThan(1);
  });
  it('aggregate averages across repos', () => {
    const good = scoreRepo({
      repoId: 'a', url: '',
      predicted: { classification: { repoType: 'library', framework: 'Express', database: null }, nodes: [{ id: 'express_core', label: 'Express', type: 'CORE_MODULE', sourceFiles: [] }], edges: [] },
      golden,
    });
    const agg = aggregateScores([good, good]);
    expect(agg.repoCount).toBe(2);
    expect(agg.composite).toBe(1);
  });
});