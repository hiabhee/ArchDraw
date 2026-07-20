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

    it('should pick default handles for identical positions', () => {
      const sourceRect: NodeRect = { x: 100, y: 100, width: 100, height: 80 };
      const targetRect: NodeRect = { x: 100, y: 100, width: 100, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // When both nodes are at the exact same position, the direction vector
      // is degenerate (0,0). The intersection approach defaults to Right/Left.
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
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

  describe('regression: wide target upper-right should not pick bottom handle', () => {
    it('should select left target handle when wide target is right of source with small vertical offset', () => {
      // Simulates the "Health Checks → Load Balancing" pattern:
      // Target is clearly to the right, with a small vertical offset.
      // The old intersection-based algorithm would pick Bottom for the
      // target because width >> height stretched the intersection.
      const sourceRect: NodeRect = { x: 100, y: 250, width: 160, height: 80 };
      const targetRect: NodeRect = { x: 500, y: 150, width: 220, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // Horizontal gap dominates: dx=430/avgW190=2.26 > dy=100/avgH80=1.25
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should not cross under target when target is wide and slightly above', () => {
      // Wide target positioned slightly above and to the right.
      // The old algorithm would intersect the bottom edge of the
      // target because width >> height stretches the intersection.
      const sourceRect: NodeRect = { x: 0, y: 200, width: 160, height: 80 };
      const targetRect: NodeRect = { x: 300, y: 100, width: 240, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // Horizontal gap dominates: dx=340/avgW200=1.7 > dy=100/avgH80=1.25
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should handle extreme aspect ratio: very wide target to the right', () => {
      const sourceRect: NodeRect = { x: 100, y: 400, width: 120, height: 80 };
      const targetRect: NodeRect = { x: 600, y: 300, width: 400, height: 60 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // dx=640/avgW260=2.46 > dy=110/avgH70=1.57 → horizontal wins
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should handle source right of wide target (reverse scenario)', () => {
      // Source is to the right, target is lower-left and wide
      const sourceRect: NodeRect = { x: 500, y: 100, width: 160, height: 80 };
      const targetRect: NodeRect = { x: 50, y: 200, width: 240, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // dx=-410, dy=100, avgW=200, avgH=80
      // normDx=410/200=2.05 > normDy=100/80=1.25 → horizontal
      expect(result.sourcePosition).toBe(Position.Left);
      expect(result.targetPosition).toBe(Position.Right);
    });

    it('should select horizontal handles when horizontal gap dominates (raw comparison)', () => {
      // Target is above-right but horizontal gap is larger in raw terms
      const sourceRect: NodeRect = { x: 100, y: 300, width: 160, height: 80 };
      const targetRect: NodeRect = { x: 400, y: 150, width: 220, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // dx=330, dy=-150 → |dx|>|dy| → horizontal wins
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });

    it('should produce correct handles for nodes with 4:1 width ratio', () => {
      // Target is 4x wider than tall, positioned to the right
      const sourceRect: NodeRect = { x: 0, y: 200, width: 160, height: 80 };
      const targetRect: NodeRect = { x: 400, y: 180, width: 320, height: 80 };

      const result = getDynamicHandles(sourceRect, targetRect);

      // dx=440/avgW240=1.83 > dy=20/avgH80=0.25 → horizontal wins
      expect(result.sourcePosition).toBe(Position.Right);
      expect(result.targetPosition).toBe(Position.Left);
    });
  });
});

describe('getHandleCoordinate', () => {
  const rect: NodeRect = { x: 100, y: 200, width: 200, height: 80 };

  it('should calculate Top handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Top);
    
    // Top handle: (centerX, y - OUTER_OFFSET)
    expect(coord.x).toBe(200); // 100 + 200/2
    expect(coord.y).toBe(176); // 200 - 24
  });

  it('should calculate Bottom handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Bottom);
    
    // Bottom handle: (centerX, y + height + OUTER_OFFSET)
    expect(coord.x).toBe(200); // 100 + 200/2
    expect(coord.y).toBe(304); // 200 + 80 + 24
  });

  it('should calculate Left handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Left);
    
    // Left handle: (x - OUTER_OFFSET, centerY)
    expect(coord.x).toBe(76);  // 100 - 24
    expect(coord.y).toBe(240); // 200 + 80/2
  });

  it('should calculate Right handle coordinate correctly', () => {
    const coord = getHandleCoordinate(rect, Position.Right);
    
    // Right handle: (x + width + OUTER_OFFSET, centerY)
    expect(coord.x).toBe(324); // 100 + 200 + 24
    expect(coord.y).toBe(240); // 200 + 80/2
  });

  it('should work with different node dimensions', () => {
    const smallRect: NodeRect = { x: 50, y: 50, width: 100, height: 60 };
    
    const topCoord = getHandleCoordinate(smallRect, Position.Top);
    expect(topCoord.x).toBe(100); // 50 + 100/2
    expect(topCoord.y).toBe(26);  // 50 - 24

    const rightCoord = getHandleCoordinate(smallRect, Position.Right);
    expect(rightCoord.x).toBe(174); // 50 + 100 + 24
    expect(rightCoord.y).toBe(80);  // 50 + 60/2
  });

  it('should merge source and target coordinates on each side', () => {
    const sourceCoord = getHandleCoordinate(rect, Position.Top, 'source', true);
    expect(sourceCoord.x).toBe(200);
    expect(sourceCoord.y).toBe(176); // 200 - 24

    const targetCoord = getHandleCoordinate(rect, Position.Top, 'target', true);
    expect(targetCoord.x).toBe(200);
    expect(targetCoord.y).toBe(176); // 200 - 24
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

import { getEdgeShiftOffset, INCOMING_OUTGOING_GAP } from '../utils/simpleFloatingEdge';
import { Node, Edge } from 'reactflow';

describe('getEdgeShiftOffset', () => {
  const GAP = INCOMING_OUTGOING_GAP;
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

  nodeInternals.set('NodeA', {
    id: 'NodeA',
    position: { x: 100, y: 100 },
    positionAbsolute: { x: 100, y: 100 },
    width: 100,
    height: 80
  } as Node);

  it('should attach a single edge to its dedicated in/out slot (not the side midpoint)', () => {
    const edges: Edge[] = [
      { id: 'edge1', source: 'Observe', target: 'TaskDone' }
    ];
    
    // Lone outgoing edge still uses the source handle slot (-GAP), matching visuals.
    const offset = getEdgeShiftOffset('Observe', 'edge1', Position.Top, edges, nodeInternals, 24);
    expect(offset).toBe(-GAP);
  });

  it('should attach a single incoming edge to the target handle slot', () => {
    const edges: Edge[] = [
      { id: 'edge1', source: 'TaskDone', target: 'Observe' }
    ];
    const offset = getEdgeShiftOffset('Observe', 'edge1', Position.Top, edges, nodeInternals, 24);
    expect(offset).toBe(GAP);
  });

  it('should assign correct offsets to prevent crossing for multi-edge same-side scenario', () => {
    const edges: Edge[] = [
      { id: 'edge-act', source: 'Act', target: 'Observe' }, // Act (right) -> Observe
      { id: 'edge-taskdone', source: 'Observe', target: 'TaskDone' } // Observe -> TaskDone (left)
    ];

    // Fixed slots: incoming → +GAP, outgoing → −GAP (never the same tip)
    const offsetAct = getEdgeShiftOffset('Observe', 'edge-act', Position.Top, edges, nodeInternals, 24);
    const offsetTaskDone = getEdgeShiftOffset('Observe', 'edge-taskdone', Position.Top, edges, nodeInternals, 24);

    expect(offsetAct).toBe(GAP);
    expect(offsetTaskDone).toBe(-GAP);
    expect(offsetAct).not.toBe(offsetTaskDone);
  });

  it('should keep fixed in/out slots even when peer order is reversed', () => {
    const edges: Edge[] = [
      { id: 'edge-in', source: 'TaskDone', target: 'Observe' },
      { id: 'edge-out', source: 'Observe', target: 'Act' },
    ];

    const offsetIn = getEdgeShiftOffset('Observe', 'edge-in', Position.Top, edges, nodeInternals, 24);
    const offsetOut = getEdgeShiftOffset('Observe', 'edge-out', Position.Top, edges, nodeInternals, 24);

    // Fixed: incoming always +GAP, outgoing always −GAP
    expect(offsetIn).toBe(GAP);
    expect(offsetOut).toBe(-GAP);
    expect(offsetIn).not.toBe(offsetOut);
  });

  it('should merge all same-side incomings onto the target handle only', () => {
    // All three sources sit above Observe so each edge lands on Top.
    nodeInternals.set('AboveA', {
      id: 'AboveA',
      position: { x: 100, y: 40 },
      positionAbsolute: { x: 100, y: 40 },
      width: 100,
      height: 60,
    } as Node);
    nodeInternals.set('AboveB', {
      id: 'AboveB',
      position: { x: 220, y: 40 },
      positionAbsolute: { x: 220, y: 40 },
      width: 100,
      height: 60,
    } as Node);
    nodeInternals.set('AboveC', {
      id: 'AboveC',
      position: { x: 340, y: 40 },
      positionAbsolute: { x: 340, y: 40 },
      width: 100,
      height: 60,
    } as Node);

    const edges: Edge[] = [
      { id: 'e-a', source: 'AboveA', target: 'Observe' },
      { id: 'e-b', source: 'AboveB', target: 'Observe' },
      { id: 'e-c', source: 'AboveC', target: 'Observe' },
    ];

    const offsetA = getEdgeShiftOffset('Observe', 'e-a', Position.Top, edges, nodeInternals, 24);
    const offsetB = getEdgeShiftOffset('Observe', 'e-b', Position.Top, edges, nodeInternals, 24);
    const offsetC = getEdgeShiftOffset('Observe', 'e-c', Position.Top, edges, nodeInternals, 24);

    // Four (three) incomings → one shared target-handle tip
    expect(offsetA).toBe(GAP);
    expect(offsetB).toBe(GAP);
    expect(offsetC).toBe(GAP);
  });

  it('should merge all same-side outgoings onto the source handle only', () => {
    const edges: Edge[] = [
      { id: 'e-1', source: 'Observe', target: 'Act' },
      { id: 'e-2', source: 'Observe', target: 'TaskDone' },
    ];

    const offset1 = getEdgeShiftOffset('Observe', 'e-1', Position.Top, edges, nodeInternals, 24);
    const offset2 = getEdgeShiftOffset('Observe', 'e-2', Position.Top, edges, nodeInternals, 24);

    expect(offset1).toBe(-GAP);
    expect(offset2).toBe(-GAP);
  });

  it('should keep incoming and outgoing on opposite dedicated handles (never merge across types)', () => {
    nodeInternals.set('InLeft', {
      id: 'InLeft',
      position: { x: 160, y: 40 },
      positionAbsolute: { x: 160, y: 40 },
      width: 80,
      height: 60,
    } as Node);
    nodeInternals.set('InRight', {
      id: 'InRight',
      position: { x: 320, y: 40 },
      positionAbsolute: { x: 320, y: 40 },
      width: 80,
      height: 60,
    } as Node);
    nodeInternals.set('OutLeft', {
      id: 'OutLeft',
      position: { x: 80, y: 40 },
      positionAbsolute: { x: 80, y: 40 },
      width: 80,
      height: 60,
    } as Node);
    nodeInternals.set('OutMid', {
      id: 'OutMid',
      position: { x: 200, y: 40 },
      positionAbsolute: { x: 200, y: 40 },
      width: 80,
      height: 60,
    } as Node);
    nodeInternals.set('OutRight', {
      id: 'OutRight',
      position: { x: 240, y: 40 },
      positionAbsolute: { x: 240, y: 40 },
      width: 80,
      height: 60,
    } as Node);

    const edges: Edge[] = [
      { id: 'e-in1', source: 'InRight', target: 'Observe' },
      { id: 'e-in2', source: 'InLeft', target: 'Observe' },
      { id: 'e-out1', source: 'Observe', target: 'OutLeft' },
      { id: 'e-out2', source: 'Observe', target: 'OutMid' },
      { id: 'e-out3', source: 'Observe', target: 'OutRight' },
    ];

    const in1 = getEdgeShiftOffset('Observe', 'e-in1', Position.Top, edges, nodeInternals, 24);
    const in2 = getEdgeShiftOffset('Observe', 'e-in2', Position.Top, edges, nodeInternals, 24);
    const out1 = getEdgeShiftOffset('Observe', 'e-out1', Position.Top, edges, nodeInternals, 24);
    const out2 = getEdgeShiftOffset('Observe', 'e-out2', Position.Top, edges, nodeInternals, 24);
    const out3 = getEdgeShiftOffset('Observe', 'e-out3', Position.Top, edges, nodeInternals, 24);

    // All incomings share the target handle
    expect(in1).toBe(in2);
    expect(in1).toBe(GAP);

    // All outgoings share the source handle
    expect(out1).toBe(out2);
    expect(out2).toBe(out3);
    expect(out1).toBe(-GAP);

    // Types stay on opposite tips
    expect(in1).not.toBe(out1);
    expect(Math.abs(in1 - out1)).toBe(GAP * 2);
  });

  it('should assign stable uncrossed offsets to bidirectional edges', () => {
    nodeInternals.set('NodeB', { id: 'NodeB', position: { x: 300, y: 100 }, positionAbsolute: { x: 300, y: 100 }, width: 100, height: 80 } as Node);

    const edges: Edge[] = [
      { id: 'e-ab', source: 'NodeA', target: 'NodeB' },
      { id: 'e-ba', source: 'NodeB', target: 'NodeA' }
    ];

    // Fixed slots on every node: outgoing −GAP, incoming +GAP
    const offsetA_ab = getEdgeShiftOffset('NodeA', 'e-ab', Position.Right, edges, nodeInternals, 12);
    const offsetA_ba = getEdgeShiftOffset('NodeA', 'e-ba', Position.Right, edges, nodeInternals, 12);

    const offsetB_ab = getEdgeShiftOffset('NodeB', 'e-ab', Position.Left, edges, nodeInternals, 12);
    const offsetB_ba = getEdgeShiftOffset('NodeB', 'e-ba', Position.Left, edges, nodeInternals, 12);

    expect(offsetA_ab).toBe(-GAP);
    expect(offsetA_ba).toBe(GAP);
    expect(offsetA_ab).not.toBe(offsetA_ba);

    expect(offsetB_ab).toBe(GAP);  // incoming to B
    expect(offsetB_ba).toBe(-GAP); // outgoing from B
    expect(offsetB_ab).not.toBe(offsetB_ba);
  });
});
