import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get, set, clear } from '../diagramCache';
import type { GenerationResult } from '../../types';

function makeResult(id: string): GenerationResult {
  return {
    type: 'architecture',
    nodes: [{ id, type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: id, icon: '', layer: 'compute' } }],
    edges: [],
    metadata: {
      totalNodes: 1,
      totalEdges: 0,
      systemType: 'web',
      generatedAt: new Date().toISOString(),
    },
  } as GenerationResult;
}

describe('diagramCache (prompt)', () => {
  beforeEach(() => {
    clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clear();
  });

  it('returns the cached result for an identical prompt', () => {
    set('build a payment system', 2, 'model-a', makeResult('r1'));
    expect(get('build a payment system', 2, 'model-a')?.nodes[0].id).toBe('r1');
  });

  it('keys by detail level and model', () => {
    set('build a payment system', 2, 'model-a', makeResult('r2'));
    set('build a payment system', 2, 'model-b', makeResult('r3'));
    set('build a payment system', 3, 'model-a', makeResult('r4'));
    expect(get('build a payment system', 2, 'model-a')?.nodes[0].id).toBe('r2');
    expect(get('build a payment system', 2, 'model-b')?.nodes[0].id).toBe('r3');
    expect(get('build a payment system', 3, 'model-a')?.nodes[0].id).toBe('r4');
    expect(get('build a payment system', 2)).toBeNull();
  });

  it('normalizes prompt whitespace and case', () => {
    set('  Build   a PAYMENT system! ', 1, undefined, makeResult('r5'));
    expect(get('build a payment system', 1, undefined)?.nodes[0].id).toBe('r5');
  });

  it('returns null after the TTL expires', () => {
    set('build a payment system', 2, 'model-a', makeResult('r6'));
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(get('build a payment system', 2, 'model-a')).toBeNull();
  });
});
