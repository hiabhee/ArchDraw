import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import { resolveEdgeStrokeDasharray, resolveEdgeStrokeDasharrayFromEdge } from '../edgeStroke';

describe('resolveEdgeStrokeDasharray', () => {
  it('uses explicit edge style dash when present', () => {
    expect(resolveEdgeStrokeDasharray({}, { strokeDasharray: '3 3' })).toBe('3,3');
  });

  it('stays solid for pipeline-inferred async (connectionType only)', () => {
    expect(resolveEdgeStrokeDasharray({ connectionType: 'async' })).toBeUndefined();
  });

  it('dashes explicitly user-chosen async edge types', () => {
    expect(resolveEdgeStrokeDasharray({ edgeType: 'async' })).toBe('8,6');
  });

  it('dashes control-plane edges (diagnostic importance)', () => {
    expect(resolveEdgeStrokeDasharray({ connectionType: 'sync', importance: 'diagnostic' })).toBe('5,4');
  });

  it('dashes optional edges', () => {
    expect(resolveEdgeStrokeDasharray({ importance: 'optional' })).toBe('5,4');
  });

  it('matches dotted variant', () => {
    expect(resolveEdgeStrokeDasharray({ edgeVariant: 'dotted' })).toBe('2,2');
  });

  it('falls back to edge type config dash', () => {
    expect(resolveEdgeStrokeDasharray({ edgeType: 'dep' })).toBe('6,6');
  });

  it('reads from a full edge object', () => {
    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      data: { edgeVariant: 'dotted' },
    } as Edge;
    expect(resolveEdgeStrokeDasharrayFromEdge(edge)).toBe('2,2');
  });
});
