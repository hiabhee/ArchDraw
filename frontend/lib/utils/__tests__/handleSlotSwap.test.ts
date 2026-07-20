import { describe, it, expect } from 'vitest';
import { Position, type Node, type Edge } from 'reactflow';
import {
  getIncomingOutgoingSlotSigns,
  getHandleSlotLayout,
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

describe('getIncomingOutgoingSlotSigns', () => {
  const internals = new Map<string, Node>([
    ['hub', node('hub', 200, 200)],
    ['high', node('high', 200, 50)],   // above hub
    ['low', node('low', 200, 350)],    // below hub
    ['left', node('left', 50, 200)],
    ['right', node('right', 350, 200)],
  ]);

  it('places incoming toward peers that sit earlier on the tangent axis', () => {
    // Right side of hub: incoming from high (smaller Y), outgoing to low (larger Y)
    const incoming: Edge[] = [{ id: 'in', source: 'high', target: 'hub' }];
    const outgoing: Edge[] = [{ id: 'out', source: 'hub', target: 'low' }];

    const signs = getIncomingOutgoingSlotSigns(
      'hub',
      Position.Right,
      incoming,
      outgoing,
      internals,
    );

    expect(signs.incomingSign).toBe(-1);
    expect(signs.outgoingSign).toBe(1);
  });

  it('swaps slots when peer order is reversed', () => {
    const incoming: Edge[] = [{ id: 'in', source: 'low', target: 'hub' }];
    const outgoing: Edge[] = [{ id: 'out', source: 'hub', target: 'high' }];

    const signs = getIncomingOutgoingSlotSigns(
      'hub',
      Position.Right,
      incoming,
      outgoing,
      internals,
    );

    expect(signs.incomingSign).toBe(1);
    expect(signs.outgoingSign).toBe(-1);
  });

  it('assigns opposite signs on opposite ends of a bidirectional pair', () => {
    const ab: Edge = { id: 'ab', source: 'left', target: 'right' };
    const ba: Edge = { id: 'ba', source: 'right', target: 'left' };

    const leftSigns = getIncomingOutgoingSlotSigns(
      'left',
      Position.Right,
      [ba],
      [ab],
      internals,
    );
    const rightSigns = getIncomingOutgoingSlotSigns(
      'right',
      Position.Left,
      [ab],
      [ba],
      internals,
    );

    expect(leftSigns.outgoingSign).toBe(rightSigns.incomingSign);
    expect(leftSigns.incomingSign).toBe(rightSigns.outgoingSign);
    // Opposite groups on the same node stay on opposite slots.
    expect(leftSigns.outgoingSign).toBe(-leftSigns.incomingSign);
  });
});

describe('getHandleSlotLayout', () => {
  const internals = new Map<string, Node>([
    ['hub', node('hub', 200, 200)],
    ['high', node('high', 200, 50)],
    ['low', node('low', 200, 350)],
  ]);

  it('defaults to source above/left and target below/right when only one direction exists', () => {
    const edges: Edge[] = [{ id: 'out', source: 'hub', target: 'high' }];
    const layout = getHandleSlotLayout('hub', Position.Right, edges, internals);
    expect(layout.sourceOffset).toBe(-INCOMING_OUTGOING_GAP);
    expect(layout.targetOffset).toBe(INCOMING_OUTGOING_GAP);
  });

  it('swaps visual source/target offsets to match uncrossed edge slots', () => {
    const edges: Edge[] = [
      { id: 'in', source: 'low', target: 'hub' },
      { id: 'out', source: 'hub', target: 'high' },
    ];
    const layout = getHandleSlotLayout('hub', Position.Right, edges, internals);
    // Incoming peers below → incoming (target) on positive slot; outgoing on negative.
    expect(layout.targetOffset).toBe(INCOMING_OUTGOING_GAP);
    expect(layout.sourceOffset).toBe(-INCOMING_OUTGOING_GAP);
  });
});
