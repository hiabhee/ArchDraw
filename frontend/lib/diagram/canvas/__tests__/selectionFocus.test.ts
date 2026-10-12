import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeSelectionFocus, selectionFocusCss } from '../selectionFocus';

const node = (id: string, parentNode?: string, type = 'shapeNode') => ({ id, type, parentNode, position: { x: 0, y: 0 }, data: {} }) as Node;
const edge = (id: string, source: string, target: string) => ({ id, source, target }) as Edge;

const nodes = [
  node('client'), node('api'), node('db'), node('cache'), node('other'),
  node('backend', undefined, 'groupNode'), node('worker', 'backend'), node('queue', 'backend'),
];
const edges = [
  edge('e1', 'client', 'api'),
  edge('e2', 'api', 'db'),
  edge('e3', 'api', 'cache'),
  edge('e4', 'db', 'other'),
  edge('e5', 'api', 'worker'),
  edge('e6', 'worker', 'queue'),
];

describe('computeSelectionFocus', () => {
  it('is null without a selection', () => {
    expect(computeSelectionFocus([], nodes, edges)).toBeNull();
  });

  it('keeps the node, its incoming and outgoing neighbours and those edges', () => {
    const focus = computeSelectionFocus(['api'], nodes, edges)!;
    expect([...focus.edgeIds].sort()).toEqual(['e1', 'e2', 'e3', 'e5']);
    expect(focus.nodeIds.has('client')).toBe(true);
    expect(focus.nodeIds.has('db')).toBe(true);
    expect(focus.nodeIds.has('worker')).toBe(true);
    // Second-degree nodes and edges are dimmed.
    expect(focus.nodeIds.has('other')).toBe(false);
    expect(focus.nodeIds.has('queue')).toBe(false);
    expect(focus.edgeIds.has('e4')).toBe(false);
    // A neighbour's container stays visible.
    expect(focus.nodeIds.has('backend')).toBe(true);
  });

  it('treats a selected group as everything inside it', () => {
    const focus = computeSelectionFocus(['backend'], nodes, edges)!;
    expect([...focus.edgeIds].sort()).toEqual(['e5', 'e6']);
    expect(focus.nodeIds.has('api')).toBe(true);
    expect(focus.nodeIds.has('client')).toBe(false);
  });

  it('builds scoped CSS with escaped ids', () => {
    const css = selectionFocusCss({ nodeIds: new Set(['a"b']), edgeIds: new Set(['e']) });
    expect(css).toContain('.archdraw-focus .react-flow__node[data-id="a\\"b"]');
    expect(css).toContain('.react-flow__edge[data-testid="rf__edge-e"]');
    expect(css).toContain('opacity: 0.5 !important');
  });
});
