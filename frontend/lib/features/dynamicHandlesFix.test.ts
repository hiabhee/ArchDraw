import { describe, it, expect } from 'vitest';
import { getObstacleAwareHandles } from './dynamicHandles';
import { getEdgeShiftOffset } from '../utils/simpleFloatingEdge';
import { Position, Node, Edge } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';

describe('Dynamic Handles Fixes', () => {
  it('should evaluate all 16 combination pairs when calculating obstacle-aware handles', () => {
    // Source: {0,0}, Target: {300, 0}
    const sourceRect = { x: 0, y: 0, width: 100, height: 50 };
    const targetRect = { x: 300, y: 0, width: 100, height: 50 };

    // Place obstacles that completely cover Target's Left, Top, and Bottom handles
    const nodeRects = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    // Target Left is at (300, 25). Block it:
    nodeRects.set('block-left', { id: 'block-left', x: 280, y: 15, w: 30, h: 20 });
    // Target Top is at (350, 0). Block it:
    nodeRects.set('block-top', { id: 'block-top', x: 340, y: -20, w: 20, h: 30 });
    // Target Bottom is at (350, 50). Block it:
    nodeRects.set('block-bottom', { id: 'block-bottom', x: 340, y: 40, w: 20, h: 30 });

    const handles = getObstacleAwareHandles(sourceRect, targetRect, nodeRects, new Set(['source', 'target']));
    
    expect(handles.sourcePosition).toBeDefined();
    expect(handles.targetPosition).toBeDefined();

    // Since Left, Top, and Bottom handles of target are blocked, it should pick Target's Right handle.
    // Source is to the left of Target, so source will pick Right.
    // Right-Right is a mixed (non-opposite) pair.
    expect(handles.targetPosition).toBe(Position.Right);

    const isOpposite =
      (handles.sourcePosition === Position.Left && handles.targetPosition === Position.Right) ||
      (handles.sourcePosition === Position.Right && handles.targetPosition === Position.Left) ||
      (handles.sourcePosition === Position.Top && handles.targetPosition === Position.Bottom) ||
      (handles.sourcePosition === Position.Bottom && handles.targetPosition === Position.Top);

    expect(isOpposite).toBe(false);
  });

  it('should merge parallel same-direction sibling edges into single handle', () => {
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

    // Single direction on this side (both outgoing) → all edges merge to one centered handle
    expect(offset1).toBe(0);
    expect(offset2).toBe(0);
  });
});
