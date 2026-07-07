import { describe, it, expect } from 'vitest';
import { buildSubsystemGraph, intermediateToArchitecture } from '../intermediate-graphs';
import type { Subsystem, FileEntry, StaticSignal } from '@/lib/types/repo-diagram';

describe('buildSubsystemGraph', () => {
  it('creates nodes for each subsystem', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: 'services/api', type: 'backend', fileCount: 3, files: ['services/api/server.ts'], language: 'TypeScript', detectedFramework: 'Express', entryPoints: ['server.ts'] },
      { name: 'web', path: 'apps/web', type: 'frontend', fileCount: 5, files: ['apps/web/page.tsx'], language: 'TypeScript', detectedFramework: 'Next.js', entryPoints: [] },
    ];
    const graph = buildSubsystemGraph(subsystems, []);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.some((n) => n.id === 'api' && n.type === 'API_ROUTE')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'web' && n.type === 'PAGE')).toBe(true);
  });

  it('creates inter-subsystem edges from frontend to backend', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: 'services/api', type: 'backend', fileCount: 3, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
      { name: 'web', path: 'apps/web', type: 'frontend', fileCount: 5, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const graph = buildSubsystemGraph(subsystems, []);
    const calls = graph.edges.filter((e) => e.type === 'http_call');
    expect(calls).toHaveLength(1);
    expect(calls[0].from).toBe('web');
    expect(calls[0].to).toBe('api');
  });

  it('creates external service nodes from SDK signals', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: '/', type: 'backend', fileCount: 1, files: ['server.ts'], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const files: FileEntry[] = [
      { path: 'server.ts', content: 'import Stripe from "stripe";' },
    ];
    const graph = buildSubsystemGraph(subsystems, files);
    expect(graph.nodes.some((n) => n.id === 'ext_stripe' && n.type === 'EXTERNAL_SERVICE')).toBe(true);
    expect(graph.edges.some((e) => e.from === 'api' && e.to === 'ext_stripe')).toBe(true);
  });

  it('creates database nodes from schema signals', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: '/', type: 'backend', fileCount: 1, files: ['prisma/schema.prisma'], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const files: FileEntry[] = [
      { path: 'prisma/schema.prisma', content: 'model User { id Int @id }' },
    ];
    const graph = buildSubsystemGraph(subsystems, files);
    expect(graph.nodes.some((n) => n.id === 'db_database' && n.type === 'DATABASE')).toBe(true);
    expect(graph.edges.some((e) => e.from === 'api' && e.to === 'db_database')).toBe(true);
  });

  it('creates queue nodes from queue_topic signals', () => {
    const subsystems: Subsystem[] = [
      { name: 'worker', path: '/', type: 'worker', fileCount: 1, files: ['queue.ts'], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const files: FileEntry[] = [
      { path: 'queue.ts', content: 'const q = new Queue("email-send");' },
    ];
    const graph = buildSubsystemGraph(subsystems, files);
    expect(graph.nodes.some((n) => n.id === 'queue_email_send' && n.type === 'QUEUE')).toBe(true);
  });

  it('accepts pre-extracted signals', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: '/', type: 'backend', fileCount: 1, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const signals: StaticSignal[] = [
      { type: 'sdk_usage', label: 'Stripe', source: 'server.ts', details: { category: 'payments' }, confidence: 'high' },
    ];
    const graph = buildSubsystemGraph(subsystems, [], signals);
    expect(graph.nodes.some((n) => n.id === 'ext_stripe')).toBe(true);
  });
});

describe('intermediateToArchitecture', () => {
  it('converts graph nodes to extracted nodes with subsystem info', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: '/', type: 'backend', fileCount: 5, files: ['server.ts', 'routes.ts'], language: 'TypeScript', detectedFramework: 'Express', entryPoints: ['server.ts'] },
    ];
    const graph = {
      type: 'service' as const,
      nodes: [{ id: 'api', label: 'api', type: 'API_ROUTE' }],
      edges: [],
    };
    const { nodes, edges } = intermediateToArchitecture(graph, subsystems);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('api');
    expect(nodes[0].description).toContain('5 files');
    expect(nodes[0].description).toContain('TypeScript');
    expect(nodes[0].confidence).toBe('high');
  });

  it('filters edges referencing unknown nodes', () => {
    const subsystems: Subsystem[] = [];
    const graph = {
      type: 'service' as const,
      nodes: [{ id: 'a', label: 'A', type: 'SERVICE' }],
      edges: [{ from: 'a', to: 'b', type: 'http_call', label: 'calls' }],
    };
    const { edges } = intermediateToArchitecture(graph, subsystems);
    expect(edges).toHaveLength(0);
  });

  it('maps edge types to direction and protocol', () => {
    const subsystems: Subsystem[] = [
      { name: 'web', path: '/', type: 'frontend', fileCount: 1, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
      { name: 'api', path: '/', type: 'backend', fileCount: 1, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const graph = {
      type: 'service' as const,
      nodes: [
        { id: 'web', label: 'web', type: 'PAGE' },
        { id: 'api', label: 'api', type: 'API_ROUTE' },
      ],
      edges: [
        { from: 'web', to: 'api', type: 'http_call', label: 'calls' },
      ],
    };
    const { edges } = intermediateToArchitecture(graph, subsystems);
    expect(edges).toHaveLength(1);
    expect(edges[0].direction).toBe('sync');
    expect(edges[0].protocol).toBe('http');
  });
});
