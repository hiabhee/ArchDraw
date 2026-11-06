import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { unwrapDomainResult } from '@/lib/diagram/pipeline-core';
import { runMermaidPipeline } from '../pipeline';
import { mergePreservingLayout } from '../mergePreservingLayout';

async function layout(mermaid: string) {
  const data = unwrapDomainResult(await runMermaidPipeline(mermaid));
  return { nodes: data.nodes as Node[], edges: data.edges as Edge[] };
}

const BASE = `graph LR
  subgraph be["Backend"]
    api["API"]
    worker["Worker"]
  end
  web["Web"]
  db[("Postgres")]
  web --> api
  api --> db
  worker --> db`;

function abs(nodes: Array<{ id: string; absX: number; absY: number }>, id: string) {
  const n = nodes.find((x) => x.id === id)!;
  return { x: n.absX, y: n.absY };
}

describe('mergePreservingLayout', () => {
  it('keeps user-moved positions and data (e.g. codePaths) of existing nodes', async () => {
    const first = await layout(BASE);
    const existing = first.nodes.map((n) =>
      n.id === 'web' ? { ...n, position: { x: -900, y: -700 }, data: { ...n.data, codePaths: ['frontend/**'] } } : n,
    );
    const next = await layout(BASE.replace('web --> api', 'web -->|HTTPS| api'));
    const { nodes } = mergePreservingLayout(existing, next);
    const web = nodes.find((n) => n.id === 'web')!;
    expect(web.position).toEqual({ x: -900, y: -700 });
    expect(web.data.codePaths).toEqual(['frontend/**']);
  });

  it('drops removed components and adds new ones', async () => {
    const existing = (await layout(BASE)).nodes;
    const next = await layout(BASE.replace('    worker["Worker"]\n', '    queue["Queue"]\n').replace('worker --> db', 'api --> queue'));
    const { nodes, edges } = mergePreservingLayout(existing, next, { avoidOverlap: true });
    expect(nodes.some((n) => n.id === 'worker')).toBe(false);
    expect(nodes.some((n) => n.id === 'queue')).toBe(true);
    expect(edges.every((e) => e.type === 'simpleFloating')).toBe(true);
  });

  it('pushes a new leaf off any existing leaf it would overlap', async () => {
    const first = await layout(BASE);
    const next = await layout(`${BASE}\n  cache["Cache"]\n  api --> cache`);
    // Park an existing node exactly where the fresh layout puts the new one.
    const target = next.nodes.find((n) => n.id === 'cache')!;
    const existing = first.nodes.map((n) => (n.id === 'web' ? { ...n, position: { ...target.position } } : n));

    const plain = mergePreservingLayout(existing, next);
    const separated = mergePreservingLayout(existing, next, { avoidOverlap: true });
    const leaves = separated.nodes.filter((n) => !n.isGroup);
    const cache = leaves.find((n) => n.id === 'cache')!;
    for (const other of leaves) {
      if (other.id === 'cache') continue;
      const clear =
        cache.absX >= other.absX + other.width || cache.absX + cache.width <= other.absX ||
        cache.absY >= other.absY + other.height || cache.absY + cache.height <= other.absY;
      expect(clear, `cache overlaps ${other.id}`).toBe(true);
    }
    // Existing nodes never move.
    expect(abs(separated.nodes, 'web')).toEqual(abs(plain.nodes, 'web'));
  });

  it('takes the fresh layout when the direction changed', async () => {
    const existing = (await layout(BASE)).nodes.map((n) => ({ ...n, position: { x: 5000, y: 5000 } }));
    const next = await layout(BASE.replace('graph LR', 'graph TD'));
    const { nodes } = mergePreservingLayout(existing, next, { directionChanged: true });
    expect(nodes.find((n) => n.id === 'web')!.position).toEqual(next.nodes.find((n) => n.id === 'web')!.position);
  });
});
