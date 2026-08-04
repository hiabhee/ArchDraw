import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import { mergeParallelEdges } from '../mergeParallelEdges';

function edge(id: string, source: string, target: string, overrides: Partial<Edge> = {}): Edge {
  return {
    id,
    source,
    target,
    type: 'simpleFloating',
    ...overrides,
  };
}

describe('mergeParallelEdges', () => {
  it('keeps distinct edges untouched', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'a', 'c'),
    ];
    expect(mergeParallelEdges(edges)).toHaveLength(3);
  });

  it('merges parallel edges in the same direction and combines labels', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', { label: 'calls' }),
      edge('e2', 'a', 'b', { label: 'writes' }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(mergeParallelEdges(edges)).toHaveLength(1);
    expect(merged.source).toBe('a');
    expect(merged.target).toBe('b');
    expect(merged.label).toBe('calls / writes');
    expect((merged.data as any).label).toBe('calls / writes');
    expect((merged.data as any).isMerged).toBe(true);
    expect((merged.data as any).mergedEdgeIds).toEqual(['e1', 'e2']);
  });

  it('merges bidirectional edges between the same pair', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', { label: 'queries' }),
      edge('e2', 'b', 'a', { label: 'returns' }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(mergeParallelEdges(edges)).toHaveLength(1);
    expect(merged.label).toBe('queries / returns');
  });

  it('drops the default Connection label when a real label exists', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', { label: 'queries' }),
      edge('e2', 'a', 'b', { label: 'Connection' }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(merged.label).toBe('queries');
    expect((merged.data as any).label).toBe('queries');
  });

  it('keeps the Connection label when every edge is default', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', { label: 'Connection' }),
      edge('e2', 'a', 'b', { label: 'Connection' }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(merged.label).toBe('Connection');
  });

  it('dedupes identical labels', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', { label: 'Connection' }),
      edge('e2', 'a', 'b', { label: 'Connection' }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(merged.label).toBe('Connection');
  });

  it('promotes the merged edge to async when any member is async', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', {
        label: 'calls',
        data: { connectionType: 'sync' },
      }),
      edge('e2', 'a', 'b', {
        label: 'events',
        data: { connectionType: 'async' },
      }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect((merged.data as any).connectionType).toBe('async');
    expect((merged.data as any).edgeVariant).toBe('dashed');
  });

  it('keeps sync variant when all members are sync', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', {
        label: 'calls',
        data: { connectionType: 'sync', edgeVariant: 'solid' },
      }),
      edge('e2', 'a', 'b', {
        label: 'pings',
        data: { connectionType: 'sync' },
      }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect((merged.data as any).connectionType).toBe('sync');
    expect((merged.data as any).edgeVariant).toBe('solid');
  });

  it('keeps the representative styling and handles from the first edge', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b', {
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        style: { stroke: '#f00' },
      }),
      edge('e2', 'a', 'b', {
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
      }),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(merged.id).toBe('e1');
    expect(merged.sourceHandle).toBe('source-right');
    expect(merged.targetHandle).toBe('target-left');
    expect(merged.style).toEqual({ stroke: '#f00' });
  });

  it('never merges self-loops', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'a', { label: 'retry' }),
      edge('e2', 'a', 'a', { label: 'retry' }),
      edge('e3', 'a', 'b', { label: 'calls' }),
      edge('e4', 'a', 'b', { label: 'calls' }),
    ];
    const result = mergeParallelEdges(edges);
    expect(result).toHaveLength(3);
    expect(result.filter((e) => e.source === e.target)).toHaveLength(2);
  });

  it('keeps a single edge with a fallback label', () => {
    const edges: Edge[] = [
      edge('e1', 'a', 'b'),
      edge('e2', 'a', 'b'),
    ];
    const [merged] = mergeParallelEdges(edges);
    expect(merged.label).toBeUndefined();
    expect((merged.data as any).isMerged).toBe(true);
  });
});
