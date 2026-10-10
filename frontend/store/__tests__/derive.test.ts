import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import type { DiagramState } from '../diagram/types';
import { deriveNodesAndEdges, findNodeById } from '../diagram/derive';

const nodes = [{ id: 'a' }, { id: 'b' }] as Node[];
const state = (activeCanvasId: string) => ({
  activeCanvasId,
  canvases: [{ id: 'c1', name: 'C', nodes, edges: [] }],
}) as unknown as DiagramState;

describe('deriveNodesAndEdges', () => {
  it('returns the same derived view for the same snapshot', () => {
    const s = state('c1');
    expect(deriveNodesAndEdges(s)).toBe(deriveNodesAndEdges(s));
    expect(deriveNodesAndEdges(s).nodes).toBe(nodes);
  });

  it('returns a stable empty array when no canvas is active (safe for v5 selectors)', () => {
    expect(deriveNodesAndEdges(state('missing')).nodes).toBe(deriveNodesAndEdges(state('other')).nodes);
  });
});

describe('findNodeById', () => {
  it('looks nodes up by id', () => {
    expect(findNodeById(nodes, 'b')).toBe(nodes[1]);
    expect(findNodeById(nodes, 'z')).toBeUndefined();
  });
});
