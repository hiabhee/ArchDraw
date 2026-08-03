import { describe, it, expect } from 'vitest';
import {
  expandBaselineFromSignals,
  deduplicateNodes,
  pruneNoisyEdges,
  applyReviewCorrections,
  isImportantOrphan,
} from '../graph-quality';
import type { ExtractedNode, RichEdge, StaticSignal } from '@/lib/types/repo-diagram';

describe('expandBaselineFromSignals', () => {
  it('adds grouped API route nodes from route signals', () => {
    const baseline: ExtractedNode[] = [
      {
        id: 'root',
        label: 'Next.js Application',
        type: 'API_ROUTE',
        description: 'root',
        sourceFiles: [],
        confidence: 'high',
      },
    ];
    const signals: StaticSignal[] = [
      { type: 'route', label: 'route.ts', source: 'app/api/auth/route.ts', details: {}, confidence: 'high' },
      { type: 'route', label: 'route.ts', source: 'app/api/users/route.ts', details: {}, confidence: 'high' },
    ];
    const expanded = expandBaselineFromSignals(baseline, signals);
    expect(expanded.some((n) => n.id === 'api_auth' && n.type === 'API_ROUTE')).toBe(true);
    expect(expanded.some((n) => n.id === 'api_users' && n.type === 'API_ROUTE')).toBe(true);
  });

  it('adds middleware node from middleware signals', () => {
    const signals: StaticSignal[] = [
      { type: 'middleware', label: 'middleware.ts', source: 'middleware.ts', details: {}, confidence: 'high' },
    ];
    const expanded = expandBaselineFromSignals([], signals);
    expect(expanded.some((n) => n.id === 'middleware' && n.type === 'MIDDLEWARE')).toBe(true);
  });
});

describe('deduplicateNodes', () => {
  it('merges nodes with similar labels and rewires edges', () => {
    const nodes: ExtractedNode[] = [
      { id: 'stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', description: '', sourceFiles: ['a.ts'], confidence: 'high' },
      { id: 'stripe_api', label: 'Stripe API', type: 'EXTERNAL_SERVICE', description: '', sourceFiles: ['b.ts'], confidence: 'medium' },
    ];
    const edges: RichEdge[] = [
      { from: 'api', to: 'stripe_api', type: 'external_call', label: 'uses', direction: 'sync', protocol: 'sdk', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: 'medium' },
    ];
    const { nodes: deduped, edges: rewired } = deduplicateNodes(nodes, edges);
    expect(deduped).toHaveLength(1);
    expect(rewired[0].to).toBe(deduped[0].id);
    expect(deduped[0].sourceFiles).toContain('a.ts');
    expect(deduped[0].sourceFiles).toContain('b.ts');
  });
});

describe('pruneNoisyEdges', () => {
  it('removes duplicate edges between same pair', () => {
    const nodes: ExtractedNode[] = [
      { id: 'a', label: 'A', type: 'API_ROUTE', description: '', sourceFiles: ['a.ts'], confidence: 'high' },
      { id: 'b', label: 'B', type: 'DATABASE', description: '', sourceFiles: ['b.ts'], confidence: 'high' },
    ];
    const edges: RichEdge[] = [
      { from: 'a', to: 'b', type: 'db_query', label: 'queries', direction: 'sync', protocol: 'db', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: 'low' },
      { from: 'a', to: 'b', type: 'db_query', label: 'reads', direction: 'sync', protocol: 'db', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: 'high' },
    ];
    const pruned = pruneNoisyEdges(nodes, edges);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].confidence).toBe('high');
  });
});

describe('applyReviewCorrections', () => {
  it('merges nodes and adds edges from review corrections', () => {
    const nodes: ExtractedNode[] = [
      { id: 'old', label: 'Old', type: 'SERVICE', description: '', sourceFiles: [], confidence: 'low' },
      { id: 'keep', label: 'Keep', type: 'SERVICE', description: '', sourceFiles: [], confidence: 'high' },
    ];
    const edges: RichEdge[] = [];
    const result = applyReviewCorrections(nodes, edges, [], {
      addNodes: [{ id: 'db', label: 'Database', type: 'DATABASE', description: '', sourceFiles: ['schema.prisma'], confidence: 'high' }],
      removeNodeIds: ['old'],
      mergeNodes: [],
      addEdges: [{ from: 'keep', to: 'db', type: 'db_query', label: 'queries', direction: 'sync', protocol: 'db', dataFlow: '', triggeredBy: 'user_action', description: '', confidence: 'high' }],
      removeEdgeIndexes: [],
      updateEdges: [],
      workflowCorrections: [],
    });
    expect(result.nodes.some((n) => n.id === 'db')).toBe(true);
    expect(result.nodes.some((n) => n.id === 'old')).toBe(false);
    expect(result.edges).toHaveLength(1);
  });
});

describe('isImportantOrphan', () => {
  it('drops a single-file, low-confidence orphan when the graph is well connected', () => {
    const orphan: ExtractedNode = { id: 'junk', label: 'Junk', type: 'UI_COMPONENT', description: '', sourceFiles: ['a.tsx'], confidence: 'low' };
    expect(isImportantOrphan(orphan, 8)).toBe(false);
  });

  it('drops a high-confidence directory/grouping orphan (no edges) regardless of file count', () => {
    const orphan: ExtractedNode = { id: 'frontend_components', label: 'Components', type: 'SERVICE', description: 'Components subsystem (5 files).', sourceFiles: ['a.tsx', 'b.tsx', 'c.tsx', 'd.tsx', 'e.tsx'], confidence: 'high' };
    expect(isImportantOrphan(orphan, 8)).toBe(false);
  });

  it('drops a high-confidence dependency-library orphan like React/Tailwind', () => {
    const orphan: ExtractedNode = { id: 'react', label: 'React', type: 'UI_COMPONENT', description: '', sourceFiles: ['react'], confidence: 'high' };
    expect(isImportantOrphan(orphan, 8)).toBe(false);
  });

  it('keeps a grounded core-infrastructure orphan (database / queue / cache)', () => {
    const db: ExtractedNode = { id: 'db', label: 'Database', type: 'DATABASE', description: '', sourceFiles: ['schema.prisma'], confidence: 'medium' };
    expect(isImportantOrphan(db, 8)).toBe(true);
  });

  it('keeps a grounded external-service orphan', () => {
    const svc: ExtractedNode = { id: 'stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', description: '', sourceFiles: ['lib/stripe.ts'], confidence: 'high' };
    expect(isImportantOrphan(svc, 8)).toBe(true);
  });

  it('keeps a grounded orphan when the graph is sparse (< 3 connected nodes)', () => {
    const orphan: ExtractedNode = { id: 'lonely', label: 'Lonely', type: 'UI_COMPONENT', description: '', sourceFiles: ['a.tsx'], confidence: 'low' };
    expect(isImportantOrphan(orphan, 2)).toBe(true);
  });

  it('drops an ungrounded orphan even if it is core infrastructure', () => {
    const ghost: ExtractedNode = { id: 'ghost', label: 'Ghost', type: 'DATABASE', description: '', sourceFiles: [], confidence: 'low' };
    expect(isImportantOrphan(ghost, 8)).toBe(false);
  });
});
