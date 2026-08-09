import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { reactFlowToMermaid } from '../mermaidTranslator';
import { parseMermaid } from '@/lib/mermaid/parse';
import { buildReactFlowObjects } from '@/lib/mermaid/buildReactFlow';

function rfNode(id: string, type: string, data: Record<string, unknown>, extra: Partial<Node> = {}): Node {
  return {
    id,
    type,
    data,
    position: { x: 0, y: 0 },
    ...extra,
  } as Node;
}

function rfEdge(source: string, target: string, label?: string): Edge {
  return { id: `${source}-${target}`, source, target, label } as Edge;
}

describe('reactFlowToMermaid text round-trip', () => {
  it('emits archdraw directives for text/annotation nodes and omits them as shape nodes', () => {
    const nodes: Node[] = [
      rfNode('title', 'textLabelNode', { text: 'System Architecture', fontSize: 'heading', anchor: 'top' }),
      rfNode('n1', 'annotationNode', {
        title: 'Note',
        body: 'async via queue',
        titleSize: 'medium',
        anchor: 'node',
        anchorTarget: 'API',
      }),
      rfNode('free', 'textLabelNode', { text: 'Free text', fontSize: 'small', anchor: 'none' }, { position: { x: 30, y: 40 } }),
      rfNode('API', 'shapeNode', { label: 'API' }),
      rfNode('DB', 'shapeNode', { label: 'DB' }),
    ];
    const edges: Edge[] = [rfEdge('API', 'DB')];

    const mermaid = reactFlowToMermaid(nodes, edges, 'LR');

    expect(mermaid).toContain('%% archdraw-text: {"id":"title","anchor":"top","text":"System Architecture","size":"heading"}');
    expect(mermaid).toContain('%% archdraw-note: {"id":"n1","anchor":"node","anchorTarget":"API","title":"Note","body":"async via queue","size":"medium"}');
    expect(mermaid).toContain('"id":"free"');
    expect(mermaid).toContain('"x":30,"y":40');
    expect(mermaid).not.toContain('title["System Architecture"]');
  });

  it('re-parses into matching text elements with edges intact', () => {
    const nodes: Node[] = [
      rfNode('title', 'textLabelNode', { text: 'My Title', fontSize: 'heading', anchor: 'top' }),
      rfNode('A', 'shapeNode', { label: 'A' }),
      rfNode('B', 'shapeNode', { label: 'B' }),
    ];
    const edges: Edge[] = [rfEdge('A', 'B')];

    const mermaid = reactFlowToMermaid(nodes, edges, 'TD');
    const res = parseMermaid(mermaid);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.ast.texts).toHaveLength(1);
    expect(res.ast.texts[0]).toMatchObject({ id: 'title', kind: 'text', text: 'My Title', size: 'heading', anchor: 'top' });
    expect(res.ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect(res.ast.edges).toHaveLength(1);

    // Build stage recreates a textLabelNode
    const objects = buildReactFlowObjects(res.ast);
    const textNode = objects.nodes.find((n) => n.id === 'title');
    expect(textNode?.type).toBe('textLabelNode');
    expect(textNode?.data).toMatchObject({ text: 'My Title', fontSize: 'heading', anchor: 'top' });
  });

  it('drops empty text labels from the round-trip', () => {
    const nodes: Node[] = [
      rfNode('empty', 'textLabelNode', { text: '', fontSize: 'medium', anchor: 'none' }),
      rfNode('A', 'shapeNode', { label: 'A' }),
    ];
    const mermaid = reactFlowToMermaid(nodes, [], 'LR');
    expect(mermaid).not.toContain('archdraw-text');
    const res = parseMermaid(mermaid);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ast.texts).toHaveLength(0);
  });

  it('round-trips directive-only shapes (cloud/shield/actor/monitor/mobile) via %% archdraw-shape', () => {
    const nodes: Node[] = [
      rfNode('stripe', 'shapeNode', { label: 'Stripe', shape: 'cloud' }),
      rfNode('waf', 'shapeNode', { label: 'WAF', shape: 'shield' }),
      rfNode('alice', 'shapeNode', { label: 'Alice', shape: 'actor' }),
      rfNode('web', 'shapeNode', { label: 'Web', shape: 'monitor' }),
      rfNode('app', 'shapeNode', { label: 'App', shape: 'mobile' }),
      rfNode('lb', 'shapeNode', { label: 'LB', shape: 'hexagon' }),
    ];
    const edges: Edge[] = [rfEdge('web', 'waf'), rfEdge('waf', 'lb'), rfEdge('lb', 'app'), rfEdge('alice', 'web')];

    const mermaid = reactFlowToMermaid(nodes, edges, 'TD');

    expect(mermaid).toContain('%% archdraw-shape: {"id":"stripe","shape":"cloud"}');
    expect(mermaid).toContain('%% archdraw-shape: {"id":"waf","shape":"shield"}');
    expect(mermaid).toContain('%% archdraw-shape: {"id":"alice","shape":"actor"}');
    expect(mermaid).toContain('%% archdraw-shape: {"id":"web","shape":"monitor"}');
    expect(mermaid).toContain('%% archdraw-shape: {"id":"app","shape":"mobile"}');
    // hexagon is native Mermaid — no directive needed.
    expect(mermaid).not.toContain('archdraw-shape: {"id":"lb"');

    const res = parseMermaid(mermaid);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byId = new Map(res.ast.nodes.map((n) => [n.id, n]));
    expect(byId.get('stripe')?.shapeOverride).toBe('cloud');
    expect(byId.get('waf')?.shapeOverride).toBe('shield');
    expect(byId.get('alice')?.shapeOverride).toBe('actor');
    expect(byId.get('web')?.shapeOverride).toBe('monitor');
    expect(byId.get('app')?.shapeOverride).toBe('mobile');
    expect(byId.get('lb')?.shapeOverride).toBeUndefined();

    // Build stage applies overrides into node data shapes.
    const objects = buildReactFlowObjects(res.ast);
    const shapeOf = (id: string) => objects.nodes.find((n) => n.id === id)?.data?.shape;
    expect(shapeOf('stripe')).toBe('cloud');
    expect(shapeOf('waf')).toBe('shield');
    expect(shapeOf('alice')).toBe('actor');
    expect(shapeOf('web')).toBe('monitor');
    expect(shapeOf('app')).toBe('mobile');
    expect(shapeOf('lb')).toBe('hexagon');
  });
});
