import { describe, it, expect } from 'vitest';
import { Position, type Node, type Edge } from 'reactflow';
import {
  getHandleSlotLayout,
  getEdgeShiftOffset,
  INCOMING_OUTGOING_GAP,
} from '../simpleFloatingEdge';

function node(id: string, x: number, y: number): Node {
  return {
    id,
    position: { x, y },
    positionAbsolute: { x, y },
    width: 100,
    height: 80,
    data: {},
  } as Node;
}

describe('getHandleSlotLayout (fixed dedicated slots)', () => {
  it('always places outgoing on −GAP and incoming on +GAP', () => {
    const layout = getHandleSlotLayout();
    expect(layout.sourceOffset).toBe(-INCOMING_OUTGOING_GAP);
    expect(layout.targetOffset).toBe(INCOMING_OUTGOING_GAP);
    expect(layout.sourceOffset).not.toBe(layout.targetOffset);
  });
});

describe('getEdgeShiftOffset role → dedicated tip', () => {
  const internals = new Map<string, Node>([
    ['hub', node('hub', 200, 200)],
    ['a', node('a', 50, 80)],
    ['b', node('b', 50, 200)],
    ['c', node('c', 50, 320)],
    ['d', node('d', 50, 440)],
    ['e', node('e', 400, 120)],
    ['f', node('f', 400, 280)],
  ]);

  it('merges all incomings onto the target handle', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'a', target: 'hub' },
      { id: 'i2', source: 'b', target: 'hub' },
      { id: 'i3', source: 'c', target: 'hub' },
      { id: 'i4', source: 'd', target: 'hub' },
    ];
    for (const e of edges) {
      expect(
        getEdgeShiftOffset('hub', e.id, Position.Left, edges, internals),
      ).toBe(INCOMING_OUTGOING_GAP);
    }
  });

  it('merges all outgoings onto the source handle', () => {
    const edges: Edge[] = [
      { id: 'o1', source: 'hub', target: 'e' },
      { id: 'o2', source: 'hub', target: 'f' },
    ];
    for (const e of edges) {
      expect(
        getEdgeShiftOffset('hub', e.id, Position.Right, edges, internals),
      ).toBe(-INCOMING_OUTGOING_GAP);
    }
  });

  it('never places incoming and outgoing on the same tip', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'a', target: 'hub' },
      { id: 'i2', source: 'b', target: 'hub' },
      { id: 'o1', source: 'hub', target: 'e' },
      { id: 'o2', source: 'hub', target: 'f' },
    ];
    const inOnRight = getEdgeShiftOffset('hub', 'i1', Position.Right, edges, internals);
    const outOnRight = getEdgeShiftOffset('hub', 'o1', Position.Right, edges, internals);
    expect(inOnRight).toBe(INCOMING_OUTGOING_GAP);
    expect(outOnRight).toBe(-INCOMING_OUTGOING_GAP);
    expect(inOnRight).not.toBe(outOnRight);
    expect(Math.abs(inOnRight - outOnRight)).toBe(INCOMING_OUTGOING_GAP * 2);
  });
});
