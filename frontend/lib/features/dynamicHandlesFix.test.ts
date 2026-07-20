import { describe, it, expect } from 'vitest';
import { getObstacleAwareHandles } from './dynamicHandles';
import { getEdgeShiftOffset } from '../utils/simpleFloatingEdge';
import { Position, Node, Edge } from 'reactflow';

describe('Dynamic Handles Fixes', () => {
  it('should use the shared scorer (obstacle-aware) for handle selection', () => {
    // Source: {0,0}, Target: {300, 0}
    const sourceRect = { x: 0, y: 0, width: 100, height: 50 };
    const targetRect = { x: 300, y: 0, width: 100, height: 50 };

    // Thin blocker on the default Right→Left corridor
    const nodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    nodeRects.set('block-mid', { id: 'block-mid', x: 160, y: 10, w: 40, h: 30 });

    const handles = getObstacleAwareHandles(sourceRect, targetRect, nodeRects, new Set(['source', 'target']));

    expect(handles.sourcePosition).toBeDefined();
    expect(handles.targetPosition).toBeDefined();

    // With a mid-corridor blocker, Right→Left default ortho collides — scorer
    // should pick a non-colliding pair (not necessarily opposite geometry).
    const isRightLeft =
      handles.sourcePosition === Position.Right && handles.targetPosition === Position.Left;
    expect(isRightLeft).toBe(false);
  });

  it('prefers natural LR pair when the corridor is clear', () => {
    const sourceRect = { x: 0, y: 0, width: 100, height: 50 };
    const targetRect = { x: 300, y: 0, width: 100, height: 50 };

    const handles = getObstacleAwareHandles(sourceRect, targetRect, undefined, new Set(['source', 'target']));
    expect(handles.sourcePosition).toBe(Position.Right);
    expect(handles.targetPosition).toBe(Position.Left);
  });

  it('should separate parallel same-direction edges on the same side', () => {
    const nodeInternals = new Map<string, Node>([
      ['A', { id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 50, type: 'shapeNode' }],
      ['B', { id: 'B', position: { x: 200, y: 0 }, data: { label: 'B' }, width: 100, height: 50, type: 'shapeNode' }]
    ]);

    const edges: Edge[] = [
      { id: 'edge-1', source: 'A', target: 'B' },
      { id: 'edge-2', source: 'A', target: 'B' }
    ];

    const offset1 = getEdgeShiftOffset('A', 'edge-1', Position.Right, edges, nodeInternals);
    const offset2 = getEdgeShiftOffset('A', 'edge-2', Position.Right, edges, nodeInternals);

    // 2 outgoing edges, centered: indices 0,1 → offsets -12, 12
    expect(offset1).toBe(-12);
    expect(offset2).toBe(12);
  });
});
