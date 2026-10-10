import { describe, it, expect } from 'vitest';
import { Position, type Node, type Edge } from 'reactflow';
import {
  sideFromDataString,
  getSharedTerminalEdges,
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

const internals = new Map<string, Node>([
  ['db', node('db', 400, 200)],
  ['a', node('a', 40, 120)],
  ['b', node('b', 40, 280)],
  ['c', node('c', 400, 40)],
]);

describe('sideFromDataString', () => {
  it('parses stored side strings', () => {
    expect(sideFromDataString('left')).toBe(Position.Left);
    expect(sideFromDataString('top')).toBe(Position.Top);
    expect(sideFromDataString('right')).toBe(Position.Right);
    expect(sideFromDataString('bottom')).toBe(Position.Bottom);
    expect(sideFromDataString(undefined)).toBeUndefined();
  });
});

describe('getSharedTerminalEdges (marker merge grouping)', () => {
  it('merges edges that share the same target handle side', () => {
    const edges: Edge[] = [
      { id: 'e-b', source: 'b', target: 'db', targetHandle: 'target-left' },
      { id: 'e-a', source: 'a', target: 'db', targetHandle: 'target-left' },
    ] as Edge[];
    const shared = getSharedTerminalEdges('e-b', 'db', Position.Left, edges, internals, 'target');
    expect(shared.map((e) => e.id)).toEqual(['e-a', 'e-b']);
  });

  it('does not merge edges landing on different target sides', () => {
    const edges: Edge[] = [
      { id: 'e-a', source: 'a', target: 'db', targetHandle: 'target-left' },
      { id: 'e-c', source: 'c', target: 'db', targetHandle: 'target-top' },
    ] as Edge[];
    const shared = getSharedTerminalEdges('e-a', 'db', Position.Left, edges, internals, 'target');
    expect(shared.map((e) => e.id)).toEqual(['e-a']);
  });

  it('honors the stored data side override over the handle id', () => {
    const edges: Edge[] = [
      {
        id: 'e-a',
        source: 'a',
        target: 'db',
        targetHandle: 'target-left',
        data: { targetSide: 'top' },
      },
      { id: 'e-c', source: 'c', target: 'db', targetHandle: 'target-top' },
    ] as Edge[];
    const shared = getSharedTerminalEdges('e-a', 'db', Position.Top, edges, internals, 'target');
    expect(shared.map((e) => e.id)).toEqual(['e-a', 'e-c']);
  });

  it('falls back to geometry for edges without stored handles', () => {
    const edges: Edge[] = [
      { id: 'e-b', source: 'b', target: 'db' },
      { id: 'e-a', source: 'a', target: 'db' },
    ] as Edge[];
    const shared = getSharedTerminalEdges('e-b', 'db', Position.Left, edges, internals, 'target');
    expect(shared.map((e) => e.id)).toEqual(['e-a', 'e-b']);
  });

  it('keeps the arrowhead when a sibling overrides its side via data', () => {
    // e-1 is pinned to db's TOP via an explicit data side override, while
    // e-2 renders geometrically on the LEFT. The merge must not suppress
    // e-2's arrowhead just because both edges share geometry otherwise.
    const edges: Edge[] = [
      { id: 'e-1', source: 'b', target: 'db', data: { targetSide: 'top' } },
      { id: 'e-2', source: 'a', target: 'db' },
    ] as Edge[];
    const shared = getSharedTerminalEdges('e-2', 'db', Position.Left, edges, internals, 'target');
    expect(shared.map((e) => e.id)).toEqual(['e-2']);
  });

  it('keeps incoming and outgoing on the same side as separate tip groups', () => {
    const edges: Edge[] = [
      { id: 'out', source: 'db', target: 'a', sourceHandle: 'source-left' },
      { id: 'in', source: 'b', target: 'db', targetHandle: 'target-left' },
    ] as Edge[];
    const inShared = getSharedTerminalEdges('in', 'db', Position.Left, edges, internals, 'target');
    const outShared = getSharedTerminalEdges('out', 'db', Position.Left, edges, internals, 'source');
    expect(inShared.map((e) => e.id)).toEqual(['in']);
    expect(outShared.map((e) => e.id)).toEqual(['out']);
  });
});
