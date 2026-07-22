import { describe, it, expect } from 'vitest';
import { Position, type Node, type Edge } from 'reactflow';
import {
  getHandleSlotLayout,
  getEdgeShiftOffset,
  getCenteredSides,
  INCOMING_OUTGOING_GAP,
  sideFromHandleId,
  resolveSideFromEdgeHandles,
} from '../simpleFloatingEdge';
import type { EdgeSideResolver } from '../simpleFloatingEdge';

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

describe('sideFromHandleId', () => {
  it('parses source and target handle ids', () => {
    expect(sideFromHandleId('target-top')).toBe(Position.Top);
    expect(sideFromHandleId('source-left')).toBe(Position.Left);
    expect(sideFromHandleId('target-right')).toBe(Position.Right);
    expect(sideFromHandleId('source-bottom')).toBe(Position.Bottom);
    expect(sideFromHandleId(null)).toBeUndefined();
  });

  it('resolveSideFromEdgeHandles reads the node end of an edge', () => {
    const edge: Edge = {
      id: 'e1',
      source: 'a',
      target: 'cdn',
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    };
    expect(resolveSideFromEdgeHandles(edge, 'cdn')).toBe(Position.Top);
    expect(resolveSideFromEdgeHandles(edge, 'a')).toBe(Position.Bottom);
  });
});

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

  it('keeps GAP when only incoming edges exist but no resolver is provided', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'a', target: 'hub' },
      { id: 'i2', source: 'b', target: 'hub' },
      { id: 'i3', source: 'c', target: 'hub' },
      { id: 'i4', source: 'd', target: 'hub' },
    ];
    for (const e of edges) {
      // Without resolver, conservatively keeps GAP (can't determine side assignments)
      expect(
        getEdgeShiftOffset('hub', e.id, Position.Left, edges, internals),
      ).toBe(INCOMING_OUTGOING_GAP);
    }
  });

  it('keeps GAP when only outgoing edges exist but no resolver is provided', () => {
    const edges: Edge[] = [
      { id: 'o1', source: 'hub', target: 'e' },
      { id: 'o2', source: 'hub', target: 'f' },
    ];
    for (const e of edges) {
      // Without resolver, conservatively keeps GAP
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

describe('getEdgeShiftOffset with resolveSide — centers when only one direction on side', () => {
  const internals = new Map<string, Node>([
    ['hub', node('hub', 200, 200)],
    ['left-a', node('left-a', 50, 80)],
    ['left-b', node('left-b', 50, 200)],
    ['right-e', node('right-e', 400, 120)],
    ['right-f', node('right-f', 400, 280)],
  ]);

  const resolveSide: EdgeSideResolver = (e, nodeId) => {
    if (e.target === nodeId) return Position.Left;
    return Position.Right;
  };

  it('returns 0 (centered) when side has only incoming edges', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'left-a', target: 'hub' },
      { id: 'i2', source: 'left-b', target: 'hub' },
    ];
    for (const e of edges) {
      expect(
        getEdgeShiftOffset('hub', e.id, Position.Left, edges, internals, 24, undefined, undefined, resolveSide),
      ).toBe(0);
    }
  });

  it('returns 0 (centered) when side has only outgoing edges', () => {
    const edges: Edge[] = [
      { id: 'o1', source: 'hub', target: 'right-e' },
      { id: 'o2', source: 'hub', target: 'right-f' },
    ];
    for (const e of edges) {
      expect(
        getEdgeShiftOffset('hub', e.id, Position.Right, edges, internals, 24, undefined, undefined, resolveSide),
      ).toBe(0);
    }
  });

  it('uses GAP offsets when both directions exist on the same side', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'left-a', target: 'hub' },
      { id: 'o1', source: 'hub', target: 'right-e' },
      { id: 'o2', source: 'hub', target: 'right-f' },
    ];
    // Left side: only incoming → centered
    expect(
      getEdgeShiftOffset('hub', 'i1', Position.Left, edges, internals, 24, undefined, undefined, resolveSide),
    ).toBe(0);
    // Right side: only outgoing → centered
    expect(
      getEdgeShiftOffset('hub', 'o1', Position.Right, edges, internals, 24, undefined, undefined, resolveSide),
    ).toBe(0);
  });

  it('uses GAP offsets when both directions share a side via resolveSide', () => {
    const bothSides: EdgeSideResolver = (_e, _nodeId) => Position.Left;

    const edges: Edge[] = [
      { id: 'i1', source: 'left-a', target: 'hub' },
      { id: 'o1', source: 'hub', target: 'right-e' },
    ];
    const inOffset = getEdgeShiftOffset('hub', 'i1', Position.Left, edges, internals, 24, undefined, undefined, bothSides);
    const outOffset = getEdgeShiftOffset('hub', 'o1', Position.Left, edges, internals, 24, undefined, undefined, bothSides);
    expect(inOffset).toBe(INCOMING_OUTGOING_GAP);
    expect(outOffset).toBe(-INCOMING_OUTGOING_GAP);
  });
});

describe('getCenteredSides', () => {
  const internals = new Map<string, Node>([
    ['hub', node('hub', 200, 200)],
    ['a', node('a', 50, 80)],
    ['b', node('b', 50, 200)],
    ['e', node('e', 400, 120)],
  ]);

  const resolveSide: EdgeSideResolver = (e, nodeId) => {
    if (e.target === nodeId) return Position.Left;
    return Position.Right;
  };

  it('returns all sides centered when no edges exist', () => {
    const centered = getCenteredSides('hub', [], resolveSide);
    expect(centered.size).toBe(4);
  });

  it('centers sides with only incoming edges', () => {
    const edges: Edge[] = [
      { id: 'i1', source: 'a', target: 'hub' },
    ];
    const centered = getCenteredSides('hub', edges, resolveSide);
    expect(centered.has(Position.Left)).toBe(true);
  });

  it('does not center sides with both directions', () => {
    const bothSides: EdgeSideResolver = (_e, _nodeId) => Position.Left;
    const edges: Edge[] = [
      { id: 'i1', source: 'a', target: 'hub' },
      { id: 'o1', source: 'hub', target: 'e' },
    ];
    const centered = getCenteredSides('hub', edges, bothSides);
    expect(centered.has(Position.Left)).toBe(false);
  });
});
