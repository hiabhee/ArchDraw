import { describe, it, expect } from 'vitest';
import {
  normalizeId,
  mergeLlmIntoBaseline,
  buildDependencyIntelligence,
  buildSummariesForLLM,
} from '../internal-helpers';
import type { ExtractedNode, StaticSignal, Subsystem } from '@/lib/types/repo-diagram';

const sampleNode = (overrides: Partial<ExtractedNode> = {}): ExtractedNode => ({
  id: 'svc-1',
  label: 'User Service',
  description: 'Handles user management',
  type: 'SERVICE',
  sourceFiles: ['src/user/index.ts'],
  confidence: 'high',
  layer: 'app',
  ...overrides,
});

describe('normalizeId', () => {
  it('lowercases', () => expect(normalizeId('HelloWorld')).toBe('helloworld'));
  it('replaces non-alphanumeric with underscore', () => expect(normalizeId('my-service/1.0')).toBe('my_service_1_0'));
  it('collapses multiple underscores', () => expect(normalizeId('a___b')).toBe('a_b'));
  it('trims leading/trailing underscores', () => expect(normalizeId('_foo_')).toBe('foo'));
  it('limits to 64 chars', () => expect(normalizeId('a'.repeat(100))).toHaveLength(64));
  it('defaults to "node" for empty result', () => expect(normalizeId('')).toBe('node'));
});

describe('mergeLlmIntoBaseline', () => {
  it('returns baseline when no LLM nodes', () => {
    const base = [sampleNode()];
    expect(mergeLlmIntoBaseline(base, [])).toEqual(base);
  });

  it('adds new LLM node not in baseline', () => {
    const base: ExtractedNode[] = [];
    const llm = [sampleNode({ id: 'new-svc', label: 'New Service', confidence: 'high' })];
    const result = mergeLlmIntoBaseline(base, llm);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new_svc');
  });

  it('merges overlapping nodes by normalized ID', () => {
    const base = [sampleNode({ id: 'user-service', label: 'User Service', sourceFiles: ['src/user/index.ts'] })];
    const llm = [sampleNode({ id: 'User_Service', label: 'User Service (LLM)', sourceFiles: ['src/user/handler.ts'], confidence: 'medium' })];
    const result = mergeLlmIntoBaseline(base, llm);
    expect(result).toHaveLength(1);
    // Higher confidence wins
    expect(result[0].label).toBe('User Service');
  });

  it('deduplicates by matching label keys', () => {
    const base = [sampleNode({ id: 'auth', label: 'Auth Service', sourceFiles: ['src/auth/index.ts'] })];
    const llm = [sampleNode({ id: 'auth-service', label: 'Auth Service', sourceFiles: ['src/auth/handler.ts'], confidence: 'high' })];
    const result = mergeLlmIntoBaseline(base, llm);
    // Both have same label key: 'authservice'
    expect(result).toHaveLength(1);
  });

  it('filters out generic external services from LLM', () => {
    const base: ExtractedNode[] = [];
    const llm = [sampleNode({
      id: 'ext',
      label: 'External Service',
      description: 'External Service Integration',
      type: 'EXTERNAL_SERVICE',
    })];
    const result = mergeLlmIntoBaseline(base, llm);
    expect(result).toHaveLength(0);
  });
});

describe('buildDependencyIntelligence', () => {
  const signals: StaticSignal[] = [
    { type: 'dependency', label: 'PostgreSQL', source: 'composer.json', details: { category: 'database' }, confidence: 'high' },
    { type: 'dependency', label: 'Redis', source: 'composer.json', details: { category: 'cache' }, confidence: 'medium' },
    { type: 'entry_point', label: 'Some Module', source: 'src/module/index.ts', details: {}, confidence: 'high' },
  ];

  it('filters dependency signals only', () => {
    const deps = buildDependencyIntelligence(signals);
    expect(deps).toHaveLength(2);
  });

  it('deduplicates by label', () => {
    const deps = buildDependencyIntelligence([...signals, ...signals]);
    expect(deps).toHaveLength(2);
  });

  it('sets critical path for database and queue', () => {
    const deps = buildDependencyIntelligence([
      { type: 'dependency', label: 'PostgreSQL', source: 'package.json', details: { category: 'database' }, confidence: 'high' },
      { type: 'dependency', label: 'Redis', source: 'package.json', details: { category: 'cache' }, confidence: 'high' },
    ]);
    expect(deps[0].isOnCriticalPath).toBe(true);
    expect(deps[1].isOnCriticalPath).toBe(false);
  });

  it('maps category to architectural role', () => {
    const deps = buildDependencyIntelligence([signals[0]]);
    expect(deps[0].architecturalRole).toBe('data_persistence');
  });
});

describe('buildSummariesForLLM', () => {
  it('returns summaries for each subsystem', () => {
    const subsystems: Subsystem[] = [
      { name: 'Root', path: '/', type: 'application', fileCount: 0, files: [], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
      { name: 'src', path: 'src', type: 'backend', fileCount: 5, files: ['src/api/controller.ts'], language: 'TypeScript', detectedFramework: null, entryPoints: [] },
    ];
    const signals: StaticSignal[] = [
      { type: 'entry_point', label: 'Controller', source: 'src/api/controller.ts', details: { category: 'class' }, confidence: 'high' },
    ];
    const summaries = buildSummariesForLLM(subsystems, signals);
    expect(summaries).toHaveLength(2);
    summaries.forEach(s => expect(typeof s).toBe('string'));
  });
});
