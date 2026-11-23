import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { getEffectiveNodeDimensions } from '@/lib/diagram/nodes/shapeNodeDimensions';
import { computeDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';

function node(id: string, label: string): Node {
  return { id, type: 'shapeNode', position: { x: 0, y: 0 }, data: { label } } as Node;
}

describe('relayout round-trip fixes', () => {
  it('assigns semantic icons to nodes created from Mermaid code', async () => {
    const result = await runMermaidPipeline('graph LR\n  email["Email Service"] --> payment["Payment Service"]');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nodes.find((n) => n.id === 'email')?.data.icon).toBe('arch-email');
    expect(result.data.nodes.find((n) => n.id === 'payment')?.data.icon).toBe('arch-payment');
  });

  it('preserves authored nodes and parallel routes across two layout changes', async () => {
    const nodes: Node[] = [
      { ...node('group', 'Services'), type: 'groupNode', data: { label: 'Services', isGroup: true } },
      { ...node('a', 'API'), parentNode: 'group', hidden: true, selectable: false },
      { ...node('b', 'Database'), parentNode: 'group', draggable: false, positionAbsolute: { x: 999, y: 999 } },
      { ...node('note', 'Note'), type: 'annotationNode', data: { title: 'Note', body: 'Read this first' } },
    ];
    const edges: Edge[] = [
      { id: 'request', source: 'a', target: 'b', label: 'Call', sourceHandle: 'source-top' },
      { id: 'retry', source: 'a', target: 'b', label: 'Call', sourceHandle: 'source-bottom', data: { customWaypoints: [{ x: 100, y: 300 }] } },
    ];
    const horizontal = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    expect(horizontal.success).toBe(true);
    const vertical = await layoutDiagramViaMermaid(horizontal.nodes, horizontal.edges, 'TD');

    expect(vertical.success).toBe(true);
    expect(vertical.nodes.find(n => n.id === 'a')).toMatchObject({ parentNode: 'group', hidden: true, selectable: false });
    const database = vertical.nodes.find(n => n.id === 'b');
    expect(database).toMatchObject({ parentNode: 'group', draggable: false });
    expect(database?.positionAbsolute).toBeUndefined();
    expect(database?.position).not.toEqual(nodes[2].position);
    expect(vertical.nodes.find(n => n.id === 'note')).toMatchObject({ type: 'annotationNode', data: nodes[3].data });
    expect(vertical.edges.map(e => e.id)).toEqual(['request', 'retry']);
    expect(vertical.edges[0]).toMatchObject(edges[0]);
    expect(vertical.edges[1]).toMatchObject(edges[1]);
  });

  it('reserves the rendered Studio width for the current icon preference and explicit overrides', async () => {
    const nodes = [
      node('a', 'Client'),
      { ...node('b', 'API'), data: { label: 'API', showIcon: true } },
    ];
    const edges = [{ id: 'ab', source: 'a', target: 'b' }];
    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR', { renderStyleId: 'studio-minimal', iconMode: 'off' });

    expect(result.success).toBe(true);
    for (const original of nodes) {
      expect(result.nodes.find(placed => placed.id === original.id))
        .toMatchObject(getEffectiveNodeDimensions(original, 'studio-minimal', 'off'));
    }
    expect(result.nodes.find(placed => placed.id === 'a')?.width)
      .toBeLessThan(result.nodes.find(placed => placed.id === 'b')!.width!);
  });

  it('reports a collision caused by a restored waypoint', async () => {
    const nodes = [node('a', 'Client'), node('b', 'API'), node('c', 'Database')];
    const edges: Edge[] = [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
      { id: 'ac', source: 'a', target: 'c' },
    ];
    const automatic = await layoutDiagramViaMermaid(nodes, edges, 'LR');
    const obstacle = automatic.nodes.find(n => n.id === 'b')!;
    const waypoint = { x: obstacle.position.x + obstacle.width! / 2, y: obstacle.position.y + obstacle.height! / 2 };
    const restored = await layoutDiagramViaMermaid(nodes, [
      ...edges.slice(0, 2),
      { ...edges[2], data: { customWaypoints: [waypoint] } },
    ], 'LR');
    const geometry = computeDiagramGeometryPlan(restored.nodes, restored.edges, { direction: 'LR' });

    expect(automatic.geometrySummary?.hardViolations).toBe(0);
    expect(restored.success).toBe(true);
    expect(geometry.violations).toContainEqual({ severity: 'hard', code: 'OBSTACLE_INTERSECTION', edgeId: 'ac', obstacleId: 'b' });
    expect(restored.geometrySummary).toMatchObject({ ...geometry.quality, status: geometry.status });
    expect(restored.warnings.some(warning => /^\[GEOMETRY_(INVALID|FAILED)\]/.test(warning))).toBe(true);
  });

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

  it('C1: preserves edge id + custom styling through relayout', async () => {
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
    expect((e.data as { customWaypoints?: unknown[] }).customWaypoints).toEqual([{ x: 5, y: 5 }]);
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

  it('preserves dotted labels on dashed edges through relayout', async () => {
    const nodes = [node('parse', 'Parser'), node('ingest', 'Ingestor'), node('pipeline', 'Pipeline')];
    const edges = [
      { id: 'parse-pipeline', source: 'parse', target: 'pipeline', label: 'Pipeline.execute', data: { edgeVariant: 'dashed' } },
      { id: 'ingest-pipeline', source: 'ingest', target: 'pipeline', label: 'Pipeline.execute', data: { edgeVariant: 'dashed' } },
    ] as Edge[];

    const result = await layoutDiagramViaMermaid(nodes, edges, 'LR');

    expect(result.success).toBe(true);
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((edge) => edge.label)).toEqual(['Pipeline.execute', 'Pipeline.execute']);
  });
});
