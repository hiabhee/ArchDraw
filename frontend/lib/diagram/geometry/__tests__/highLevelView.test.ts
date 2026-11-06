import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { buildHighLevelGraph, hasHighLevelView } from '../highLevelView';

const node = (id: string, type: string, parentNode?: string, data: Record<string, unknown> = {}) =>
  ({ id, type, parentNode, position: { x: 0, y: 0 }, data: { label: id, ...data } }) as Node;
const edge = (id: string, source: string, target: string, label?: string) =>
  ({ id, source, target, data: label ? { label } : {} }) as Edge;

const nodes = [
  node('api', 'groupNode'),
  node('auth', 'shapeNode', 'api'),
  node('users', 'shapeNode', 'api'),
  node('data', 'groupNode'),
  node('nested', 'groupNode', 'data'),
  node('pg', 'shapeNode', 'nested'),
  node('browser', 'shapeNode'),
  node('heading', 'textLabelNode'),
];

describe('buildHighLevelGraph', () => {
  it('is null without top-level groups', () => {
    expect(hasHighLevelView([node('a', 'shapeNode')])).toBe(false);
    expect(buildHighLevelGraph([node('a', 'shapeNode')], [])).toBeNull();
  });

  it('collapses each top-level group into one component with its size', () => {
    const graph = buildHighLevelGraph(nodes, [])!;
    expect(graph.nodes.map((n) => n.id)).toEqual(['api', 'data', 'browser']);
    const api = graph.nodes.find((n) => n.id === 'api')!;
    expect(api.type).toBe('shapeNode');
    expect(api.data.subtitle).toBe('auth · users');
    expect(graph.nodes.find((n) => n.id === 'data')!.data.subtitle).toBe('pg');
    expect(graph.nodes.every((n) => !n.parentNode)).toBe(true);
  });

  it('merges edges between groups and drops edges inside one', () => {
    const graph = buildHighLevelGraph(nodes, [
      edge('e1', 'browser', 'auth', 'login'),
      edge('e2', 'auth', 'pg'),
      edge('e3', 'users', 'pg'),
      edge('e4', 'auth', 'users'),
    ])!;
    expect(graph.edges.map((e) => [e.source, e.target, e.data?.label, e.data?.connectionCount])).toEqual([
      ['browser', 'api', undefined, 1],
      ['api', 'data', undefined, 2],
    ]);
  });
});
