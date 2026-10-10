import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { createDiagramPresentation } from '../diagramPresentation';
import type { ResolvedFlowSemantics } from '@/lib/diagram/mermaid/edgeFlowSemantics';

const nodes = ['entry', 'service', 'outcome', 'telemetry'].map(id => ({
  id, type: 'systemNode', position: { x: 0, y: 0 }, data: { label: id },
} as Node));
const makeEdges = (): Edge[] => [
  { id: 'main-1', source: 'entry', target: 'service', data: { flowRole: 'main' } },
  { id: 'main-2', source: 'service', target: 'outcome', data: { flowRole: 'main' } },
  { id: 'telemetry', source: 'service', target: 'telemetry', data: { flowRole: 'supporting', importanceSource: 'inferred' } },
] as Edge[];
const semantics = (edges: Edge[], confidence = 0.9): ResolvedFlowSemantics => ({
  assignments: new Map(edges.map(edge => [edge.id, {
    role: edge.id.startsWith('main') ? 'main' : 'supporting',
    source: 'inferred', confidence: edge.id.startsWith('main') ? 1 : confidence,
  }])),
  entryNodeIds: ['entry'], outcomeNodeIds: ['outcome'],
  mainPathEdgeIds: ['main-1', 'main-2'], mainPathNodeIds: ['entry', 'service', 'outcome'],
});

describe('createDiagramPresentation', () => {
  it('hides only high-confidence supporting links and preserves each entry/outcome path', () => {
    const edges = makeEdges();
    const overview = createDiagramPresentation(nodes, edges, semantics(edges), 'overview');
    expect(overview.hiddenEdgeIds).toEqual(new Set(['telemetry']));
    expect(overview.visibleEdgeIds).toEqual(new Set(['main-1', 'main-2']));
    expect(overview.visibleNodeIds.size).toBe(nodes.length);
  });

  it('keeps the full graph when supporting-flow confidence is below 0.85', () => {
    const edges = makeEdges();
    const overview = createDiagramPresentation(nodes, edges, semantics(edges, 0.84), 'overview');
    expect(overview.hiddenEdgeIds.size).toBe(0);
    expect(overview.visibleEdgeIds.size).toBe(edges.length);
  });

  it('never hides explicit relationships or changes Details membership', () => {
    const edges = makeEdges();
    edges[2].data = { ...edges[2].data, importanceSource: 'explicit' };
    const overview = createDiagramPresentation(nodes, edges, semantics(edges), 'overview');
    const details = createDiagramPresentation(nodes, edges, semantics(edges), 'details');
    expect(overview.visibleEdgeIds.has('telemetry')).toBe(true);
    expect(details.visibleEdgeIds).toEqual(new Set(edges.map(edge => edge.id)));
    expect(details.hiddenEdgeIds.size).toBe(0);
  });

  it('keeps a supporting edge when it is needed for entry-to-outcome reachability', () => {
    const edges = [
      { id: 'main-1', source: 'entry', target: 'service', data: {} },
      { id: 'support-bridge', source: 'service', target: 'outcome', data: {} },
    ] as Edge[];
    const resolved = semantics(edges);
    (resolved.assignments as Map<string, { role: 'supporting'; source: 'inferred'; confidence: number }>).set('support-bridge', { role: 'supporting', source: 'inferred', confidence: 0.95 });
    const overview = createDiagramPresentation(nodes.slice(0, 3), edges, resolved, 'overview');
    expect(overview.hiddenEdgeIds.size).toBe(0);
  });
});
