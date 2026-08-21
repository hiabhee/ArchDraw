import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';

function node(id: string, label: string): Node {
  return { id, type: 'shapeNode', position: { x: 0, y: 0 }, data: { label } } as Node;
}

describe('relayout round-trip fixes', () => {
  it('C2: relayout succeeds when a label contains a pipe', async () => {
    const nodes = [node('a', 'Kafka | Redpanda'), node('b', 'Consumer')];
    const edges = [{ id: 'e0', source: 'a', target: 'b' } as Edge];
    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    expect(result.success).toBe(true);
    const a = result.nodes.find((n) => n.id === 'a')!;
    expect((a.data as { label?: string }).label).toBe('Kafka | Redpanda');
  });

  it('C2: relayout succeeds when a label contains an arrow', async () => {
    const nodes = [node('a', 'retry --> fallback'), node('b', 'Consumer')];
    const edges = [{ id: 'e0', source: 'a', target: 'b' } as Edge];
    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    expect(result.success).toBe(true);
  });

  it('C1: preserves edge id + custom data through relayout', async () => {
    const nodes = [node('a', 'API'), node('b', 'DB')];
    const edges = [{
      id: 'my-stable-id',
      source: 'a',
      target: 'b',
      animated: true,
      style: { stroke: '#ff0000' },
      data: { edgeType: 'async', customWaypoints: [{ x: 5, y: 5 }] },
    } as unknown as Edge];
    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    expect(result.success).toBe(true);
    expect(result.edges).toHaveLength(1);
    const e = result.edges[0];
    expect(e.id).toBe('my-stable-id');
    expect(e.animated).toBe(true);
    expect((e.style as { stroke?: string }).stroke).toBe('#ff0000');
    expect((e.data as { customWaypoints?: unknown[] }).customWaypoints).toBeDefined();
  });

  it('C3: async-family edges serialize as dotted', () => {
    const nodes = [node('a', 'API'), node('b', 'Queue')];
    const base = { source: 'a', target: 'b' };
    const mk = (data: Record<string, unknown>) =>
      reactFlowToMermaid(nodes, [{ ...base, id: 'e', data } as unknown as Edge], 'LR');

    expect(mk({ connectionType: 'async' })).toMatch(/-\.+->/);
    expect(mk({ edgeType: 'stream' })).toMatch(/-\.+->/);
    expect(mk({ edgeType: 'event' })).toMatch(/-\.+->/);
    expect(mk({ edgeType: 'dep' })).toMatch(/-\.+->/);
    expect(mk({ syncAsync: 'async' })).toMatch(/-\.+->/);
    expect(mk({ connectionType: 'sync' })).toContain('-->');
  });

  it('C4/C5: bidirectional and invisible edges round-trip', () => {
    const nodes = [node('a', 'API'), node('b', 'DB')];
    const base = { source: 'a', target: 'b' };
    const mk = (extra: Record<string, unknown>) =>
      reactFlowToMermaid(nodes, [{ ...base, id: 'e', ...extra } as unknown as Edge], 'LR');

    expect(mk({ data: { edgeVariant: 'bidirectional' } })).toContain('<-->');
    expect(mk({ markerStart: { type: 'arrowclosed' }, markerEnd: { type: 'arrowclosed' } })).toContain('<-->');
    expect(mk({ hidden: true, data: { edgeVariant: 'invisible' } })).toContain('~~~');
    // Invisible edges must not degrade into visible dotted arrows
    expect(mk({ hidden: true, data: { edgeVariant: 'invisible', connectionType: 'async' } })).not.toMatch(/-\.+->/);
  });

  it('C2: quoted pipe label survives the full pipeline parse', async () => {
    const nodes = [node('a', 'Producer'), node('b', 'Consumer')];
    const edges = [{ id: 'e0', source: 'a', target: 'b', label: 'Kafka | Redpanda' } as Edge];
    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    expect(result.success).toBe(true);
    const e = result.edges[0];
    expect(e.label ?? (e.data as { label?: string } | undefined)?.label).toBe('Kafka | Redpanda');
  });
});
