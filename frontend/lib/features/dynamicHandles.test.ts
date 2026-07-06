/**
 * Unit tests for dynamic handle positioning
 * Tests specific examples and edge cases for handle selection logic
 */

import { describe, it, expect } from 'vitest';
import { Position } from 'reactflow';
import { getDynamicHandles, getHandleCoordinate, type NodeRect } from './dynamicHandles';

describe('getDynamicHandles', () => {
  describe('horizontal dominance scenarios', () => {
    it('should select Right → Left when target is to the right', () => {
      const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should select Left → Right when target is to the left', () => {
      const sourceRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      expect(result.sourcePosition).toBe(Position.Left);
      expect(result.targetPosition).toBe(Position.Right);
    });
  });

  describe('vertical dominance scenarios', () => {
    it('should select Bottom → Top when target is below', () => {
      const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 10, y: 200, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      expect(result.sourcePosition).toBe(Position.Bottom);
      expect(result.targetPosition).toBe(Position.Top);
    });

    it('should select Top → Bottom when target is above', () => {
      const sourceRect: NodeRect = { x: 0, y: 200, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 10, y: 0, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      expect(result.sourcePosition).toBe(Position.Top);
      expect(result.targetPosition).toBe(Position.Bottom);
    });
  });

  describe('tie-breaking and edge cases', () => {
    it('should select horizontal handles when vertical gap is below threshold (horizontal preference tie-break)', () => {
      const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 100, y: 0, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // Centers: source(50,40), target(150,40); dy=0 < verticalThreshold(30) → horizontal
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should pick the shortest handle pair for identical positions', () => {
      const sourceRect: NodeRect = { x: 100, y: 100, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 100, y: 100, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // Node is wider (100) than tall (80), so Top→Bottom (104) is shorter
      // than Right→Left (124). Picks the side pair with shortest Manhattan
      // distance between handle positions.
      expect(result.sourcePosition).toBe(Position.Top);
      expect(result.targetPosition).toBe(Position.Bottom);
    });

    it('should work with different node dimensions when vertically aligned', () => {
      const sourceRect: NodeRect = { x: 0, y: 0, width: 200, height: 100 };
      const targetRect: NodeRect = { x: 300, y: 20, width: 150, height: 60 }; // Center Y aligned at 50

      const result = getDynamicHandles(sourceRect, targetRect);

      // Target is to the right and vertically aligned
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should avoid overlapping/tangling by selecting Top/Bottom handles based on relative vertical positions', () => {
      // "Enjoy your day" (source) is at (75, 140) center:
      const sourceRect: NodeRect = { x: 0, y: 100, width: 150, height: 80 };

      // Node 1 (above-right target) is above (mostly vertically, center X at 95, center Y at 40):
      const targetAboveRect: NodeRect = { x: 20, y: 0, width: 150, height: 80 };
      const resultAbove = getDynamicHandles(sourceRect, targetAboveRect);
      // Case 2: Target node is above the source node -> source Top, target Bottom
      expect(resultAbove.sourcePosition).toBe(Position.Top);
      expect(resultAbove.targetPosition).toBe(Position.Bottom);

      // Node 2 (below-right target) is below (mostly vertically, center X at 95, center Y at 240):
      const targetBelowRect: NodeRect = { x: 20, y: 200, width: 150, height: 80 };
      const resultBelow = getDynamicHandles(sourceRect, targetBelowRect);
      // Case 1: Target node is below the source node -> source Bottom, target Top
      expect(resultBelow.sourcePosition).toBe(Position.Bottom);
      expect(resultBelow.targetPosition).toBe(Position.Top);
    });
  });
});

describe('getHandleCoordinate', () => {
  const rect: NodeRect = { x: 100, y: 200, width: 200, height: 80 };

  it('should calculate Top handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Top);
    
    // Top handle: (centerX, y - OUTER_OFFSET)
    expect(coord.x).toBe(200); // 100 + 200/2
    expect(coord.y).toBe(188); // 200 - 12
  });

  it('should calculate Bottom handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Bottom);
    
    // Bottom handle: (centerX, y + height + OUTER_OFFSET)
    expect(coord.x).toBe(200); // 100 + 200/2
    expect(coord.y).toBe(292); // 200 + 80 + 12
  });

  it('should calculate Left handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Left);
    
    // Left handle: (x - OUTER_OFFSET, centerY)
    expect(coord.x).toBe(88);  // 100 - 12
    expect(coord.y).toBe(240); // 200 + 80/2
  });

  it('should calculate Right handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Right);
    
    // Right handle: (x + width + OUTER_OFFSET, centerY)
    expect(coord.x).toBe(312); // 100 + 200 + 12
    expect(coord.y).toBe(240); // 200 + 80/2
  });

  it('should work with different node dimensions', () => {
    const smallRect: NodeRect = { x: 50, y: 50, width: 100, height: 60 };
    
    const topCoord = getHandleCoordinate(smallRect, Position.Top);
    expect(topCoord.x).toBe(100); // 50 + 100/2
    expect(topCoord.y).toBe(38);  // 50 - 12

    const rightCoord = getHandleCoordinate(smallRect, Position.Right);
    expect(rightCoord.x).toBe(162); // 50 + 100 + 12
    expect(rightCoord.y).toBe(80);  // 50 + 60/2
  });

  it('should apply bidirectional offsets of ±12px correctly', () => {
    const sourceCoord = getHandleCoordinate(rect, Position.Top, 'source', true);
    // Source Top handle: (centerX + 12, y - OUTER_OFFSET)
    expect(sourceCoord.x).toBe(212);
    expect(sourceCoord.y).toBe(188); // 200 - 12

    const targetCoord = getHandleCoordinate(rect, Position.Top, 'target', true);
    // Target Top handle: (centerX - 12, y - OUTER_OFFSET)
    expect(targetCoord.x).toBe(188);
    expect(targetCoord.y).toBe(188); // 200 - 12
  });
});

describe('backward compatibility and error handling', () => {
  it('should ignore legacy sourceHandle/targetHandle and use dynamic positions', () => {
    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect);

    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
  });

  it('should handle missing node dimensions via zero-width/height gracefully', () => {
    const sourceRect: NodeRect = { x: 0, y: 0, width: 0, height: 0 };
    const targetRect: NodeRect = { x: 100, y: 0, width: 0, height: 0 };

    const result = getDynamicHandles(sourceRect, targetRect);

    const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
    expect(validPositions).toContain(result.sourcePosition);
    expect(validPositions).toContain(result.targetPosition);
  });
});

import { getEdgeShiftOffset } from '../utils/simpleFloatingEdge';
import { Node, Edge } from 'reactflow';

describe('getEdgeShiftOffset', () => {
  const nodeInternals = new Map<string, Node>();
  
  // Set up nodes
  // Center Node: Observe at (200, 200)
  nodeInternals.set('Observe', {
    id: 'Observe',
    position: { x: 200, y: 200 },
    positionAbsolute: { x: 200, y: 200 },
    width: 160,
    height: 80
  } as Node);

  // Left Node: Task Done? at (90, 50)
  nodeInternals.set('TaskDone', {
    id: 'TaskDone',
    position: { x: 90, y: 50 },
    positionAbsolute: { x: 90, y: 50 },
    width: 160,
    height: 80
  } as Node);

  // Right Node: Act at (230, 50)
  nodeInternals.set('Act', {
    id: 'Act',
    position: { x: 230, y: 50 },
    positionAbsolute: { x: 230, y: 50 },
    width: 160,
    height: 80
  } as Node);

  it('should return 0 offset for a single edge on a side', () => {
    const edges: Edge[] = [
      { id: 'edge1', source: 'Observe', target: 'TaskDone' }
    ];
    
    const offset = getEdgeShiftOffset('Observe', 'edge1', Position.Top, edges, nodeInternals, 12);
    expect(offset).toBe(0);
  });

  it('should assign correct offsets to prevent crossing for multi-edge same-side scenario', () => {
    const edges: Edge[] = [
      { id: 'edge-act', source: 'Act', target: 'Observe' }, // Act (right) -> Observe
      { id: 'edge-taskdone', source: 'Observe', target: 'TaskDone' } // Observe -> TaskDone (left)
    ];

    // Both edges connect to Observe's Top side:
    // - Act center is (310, 90). Observe center is (280, 240).
    //   dy = 150 > dx = 30 -> targetPos = Top, sourcePos = Bottom
    // - TaskDone center is (170, 90). Observe center is (280, 240).
    //   dy = -150, dx = -110 -> |dy| > |dx| -> sourcePos = Top, targetPos = Bottom

    const offsetAct = getEdgeShiftOffset('Observe', 'edge-act', Position.Top, edges, nodeInternals, 12);
    const offsetTaskDone = getEdgeShiftOffset('Observe', 'edge-taskdone', Position.Top, edges, nodeInternals, 12);

    // 2 edges on the same side, evenly spaced at 15px centered on the node.
    // Original order preserved: edge-act first (idx 0 → -7.5), edge-taskdone second (idx 1 → +7.5).
    expect(offsetAct).toBe(-7.5);
    expect(offsetTaskDone).toBe(7.5);
  });

  it('should assign stable offsets to bidirectional edges to prevent crossing', () => {
    // Bidirectional edges between Observe and Act:
    // 1. Observe -> Act
    // 2. Act -> Observe
    // Both connect to Observe on Position.Top / Act on Position.Bottom (or horizontal if same level)
    // Let's force horizontal by putting them on same Y
    nodeInternals.set('NodeA', { id: 'NodeA', position: { x: 100, y: 100 }, positionAbsolute: { x: 100, y: 100 }, width: 100, height: 80 } as Node);
    nodeInternals.set('NodeB', { id: 'NodeB', position: { x: 300, y: 100 }, positionAbsolute: { x: 300, y: 100 }, width: 100, height: 80 } as Node);

    const edges: Edge[] = [
      { id: 'e-ab', source: 'NodeA', target: 'NodeB' },
      { id: 'e-ba', source: 'NodeB', target: 'NodeA' }
    ];

    // NodeA is at X=100 (left), NodeB is at X=300 (right).
    // Edges will connect via NodeA's Position.Right and NodeB's Position.Left.
    const offsetA_ab = getEdgeShiftOffset('NodeA', 'e-ab', Position.Right, edges, nodeInternals, 12);
    const offsetA_ba = getEdgeShiftOffset('NodeA', 'e-ba', Position.Right, edges, nodeInternals, 12);

    const offsetB_ab = getEdgeShiftOffset('NodeB', 'e-ab', Position.Left, edges, nodeInternals, 12);
    const offsetB_ba = getEdgeShiftOffset('NodeB', 'e-ba', Position.Left, edges, nodeInternals, 12);

    // 2 edges per side, evenly spaced 15px centered on the node.
    // Order preserves edges array order: e-ab (idx 0 → -7.5), e-ba (idx 1 → +7.5).
    expect(offsetA_ab).toBe(-7.5);
    expect(offsetA_ba).toBe(7.5);

    // Same ordering on NodeB side.
    expect(offsetB_ab).toBe(-7.5);
    expect(offsetB_ba).toBe(7.5);

    // Note that because both connect at NodeA.Right (y: cy - 6 / cy + 6) and NodeB.Left (y: cy - 6 / cy + 6),
    // they run parallel (A.Right_top connects to B.Left_top, A.Right_bottom connects to B.Left_bottom).
    // No crossing occurs!
  });
});
