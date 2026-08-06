import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import { resolveEdgeStrokeDasharray, resolveEdgeStrokeDasharrayFromEdge } from '../edgeStroke';

describe('resolveEdgeStrokeDasharray', () => {
  it('uses explicit edge style dash when present', () => {
    expect(resolveEdgeStrokeDasharray({}, { strokeDasharray: '3 3' })).toBe('3,3');
  });

  it('matches canvas async dashed edges', () => {
    expect(resolveEdgeStrokeDasharray({ connectionType: 'async' })).toBe('5,4');
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
