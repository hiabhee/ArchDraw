import { describe, it, expect } from 'vitest';
import { Position, type Edge } from 'reactflow';
import { computeDynamicSlotOffsets } from '../handleSlotOrder';

const GAP = 16;

function pos(
  id: string,
  x: number,
  y: number,
  w: number = 160,
  h: number = 80,
): { id: string; x: number; y: number; width: number; height: number } {
  return { id, x, y, width: w, height: h };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
): Edge {
  return { id, source, target, sourceHandle, targetHandle } as Edge;
}

describe('computeDynamicSlotOffsets', () => {
  describe('left side — uses Y-centers', () => {
    it('incoming above outgoing → incoming gets top slot (negative offset)', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['above', pos('above', 50, 50)],
        ['below', pos('below', 50, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'above', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'below', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });

    it('incoming below outgoing → incoming gets bottom slot (positive offset)', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['above', pos('above', 50, 50)],
        ['below', pos('below', 50, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'center', 'above', 'source-left', 'target-left'),
        makeEdge('e2', 'below', 'center', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(GAP);
      expect(result.outgoingOffset).toBe(-GAP);
    });
  });

  describe('right side — uses Y-centers', () => {
    it('incoming above outgoing → incoming gets top slot', () => {
      const nodePositions = new Map([
        ['center', pos('center', 0, 200)],
        ['above', pos('above', 400, 50)],
        ['below', pos('below', 400, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'above', 'center', 'source-right', 'target-right'),
        makeEdge('e2', 'center', 'below', 'source-right', 'target-right'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Right, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });
  });

  describe('top side — uses X-centers', () => {
    it('incoming from left, outgoing from right → incoming gets left slot', () => {
      const nodePositions = new Map([
        ['center', pos('center', 200, 300)],
        ['left', pos('left', 50, 50)],
        ['right', pos('right', 400, 50)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'left', 'center', 'source-top', 'target-top'),
        makeEdge('e2', 'center', 'right', 'source-top', 'target-top'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Top, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });

    it('incoming from right, outgoing from left → incoming gets right slot', () => {
      const nodePositions = new Map([
        ['center', pos('center', 200, 300)],
        ['left', pos('left', 50, 50)],
        ['right', pos('right', 400, 50)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'center', 'left', 'source-top', 'target-top'),
        makeEdge('e2', 'right', 'center', 'source-top', 'target-top'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Top, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(GAP);
      expect(result.outgoingOffset).toBe(-GAP);
    });
  });

  describe('bottom side — uses X-centers', () => {
    it('incoming from left, outgoing from right → incoming gets left slot', () => {
      const nodePositions = new Map([
        ['center', pos('center', 200, 0)],
        ['left', pos('left', 50, 400)],
        ['right', pos('right', 400, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'left', 'center', 'source-bottom', 'target-bottom'),
        makeEdge('e2', 'center', 'right', 'source-bottom', 'target-bottom'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Bottom, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });
  });

  describe('centered (one direction only)', () => {
    it('only incoming edges → centered', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['above', pos('above', 50, 50)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'above', 'center', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(true);
      expect(result.incomingOffset).toBe(0);
      expect(result.outgoingOffset).toBe(0);
    });

    it('only outgoing edges → centered', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['below', pos('below', 50, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'center', 'below', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(true);
      expect(result.incomingOffset).toBe(0);
      expect(result.outgoingOffset).toBe(0);
    });

    it('no edges on this side → default offsets (no geometric info)', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
      ]);
      const edges: Edge[] = [];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(GAP);
      expect(result.outgoingOffset).toBe(-GAP);
    });
  });

  describe('hysteresis — tie within 4px', () => {
    it('incoming 2px above outgoing → default ordering (no swap)', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['a', pos('a', 50, 100)],
        ['b', pos('b', 50, 102)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'a', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'b', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(GAP);
      expect(result.outgoingOffset).toBe(-GAP);
    });

    it('incoming 6px above outgoing → swapped', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['a', pos('a', 50, 100)],
        ['b', pos('b', 50, 106)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'a', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'b', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });
  });

  describe('multiple edges per role', () => {
    it('uses average Y-center of connected nodes', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['in1', pos('in1', 50, 80)],
        ['in2', pos('in2', 50, 120)],
        ['out1', pos('out1', 50, 300)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'in1', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'in2', 'center', 'source-left', 'target-left'),
        makeEdge('e3', 'center', 'out1', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);

      expect(result.centered).toBe(false);
      expect(result.incomingOffset).toBe(-GAP);
      expect(result.outgoingOffset).toBe(GAP);
    });
  });

  describe('per-side independence', () => {
    it('left side swapped, right side default simultaneously', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['leftAbove', pos('leftAbove', 50, 50)],
        ['leftBelow', pos('leftBelow', 50, 400)],
        ['rightAbove', pos('rightAbove', 600, 50)],
        ['rightBelow', pos('rightBelow', 600, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'leftAbove', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'leftBelow', 'source-left', 'target-left'),
        makeEdge('e3', 'rightBelow', 'center', 'source-right', 'target-right'),
        makeEdge('e4', 'center', 'rightAbove', 'source-right', 'target-right'),
      ];

      const left = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);
      const right = computeDynamicSlotOffsets('center', Position.Right, edges, nodePositions);

      expect(left.incomingOffset).toBe(-GAP);
      expect(left.outgoingOffset).toBe(GAP);

      expect(right.incomingOffset).toBe(GAP);
      expect(right.outgoingOffset).toBe(-GAP);
    });
  });

  describe('edges on wrong side are ignored', () => {
    it('only counts edges matching the queried side', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['above', pos('above', 50, 50)],
        ['below', pos('below', 50, 400)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'above', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'below', 'source-right', 'target-right'),
      ];

      const left = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);
      expect(left.centered).toBe(true);

      const right = computeDynamicSlotOffsets('center', Position.Right, edges, nodePositions);
      expect(right.centered).toBe(true);
    });
  });

  describe('missing node positions', () => {
    it('skips edges with unknown connected nodes', () => {
      const nodePositions = new Map([
        ['center', pos('center', 300, 200)],
        ['above', pos('above', 50, 50)],
      ]);
      const edges: Edge[] = [
        makeEdge('e1', 'above', 'center', 'source-left', 'target-left'),
        makeEdge('e2', 'center', 'unknown', 'source-left', 'target-left'),
      ];

      const result = computeDynamicSlotOffsets('center', Position.Left, edges, nodePositions);
      expect(result.centered).toBe(true);
    });
  });
});
