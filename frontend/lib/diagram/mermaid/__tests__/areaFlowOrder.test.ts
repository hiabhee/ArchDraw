import { describe, expect, it } from 'vitest';
import { markBackwardAreaEdges } from '../areaFlowOrder';
import type { RFObjects } from '../types';

const objects = {
  nodes: [
    { id: 'A', type: 'groupNode', position: { x: 0, y: 0 }, data: {} },
    { id: 'B', type: 'groupNode', position: { x: 0, y: 0 }, data: {} },
    { id: 'B_inner', type: 'groupNode', parentNode: 'B', position: { x: 0, y: 0 }, data: {} },
    { id: 'a1', type: 'shapeNode', parentNode: 'A', position: { x: 0, y: 0 }, data: {} },
    { id: 'b1', type: 'shapeNode', parentNode: 'B_inner', position: { x: 0, y: 0 }, data: {} },
  ],
  edges: [
    { id: 'fwd', source: 'a1', target: 'b1', data: {} },
    { id: 'back', source: 'b1', target: 'a1', data: {} },
  ],
} as unknown as RFObjects;

describe('markBackwardAreaEdges', () => {
  it('marks edges back to an earlier top-level area (through nested groups) as explicit feedback', () => {
    const edges = markBackwardAreaEdges(objects).edges as unknown as Array<{ id: string; data: Record<string, unknown> }>;
    expect(edges.find((e) => e.id === 'fwd')!.data.flowRole).toBeUndefined();
    expect(edges.find((e) => e.id === 'back')!.data).toMatchObject({ flowRole: 'feedback', flowRoleSource: 'explicit' });
  });

  it('uses a given area order over the declaration order', () => {
    const edges = markBackwardAreaEdges(objects, ['B', 'A']).edges as unknown as Array<{ id: string; data: Record<string, unknown> }>;
    expect(edges.find((e) => e.id === 'fwd')!.data.flowRole).toBe('feedback');
    expect(edges.find((e) => e.id === 'back')!.data.flowRole).toBeUndefined();
  });
});
