import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { unwrapDomainResult } from '@/lib/diagram/pipeline-core';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { publishGraph } from '../publishGraph';

async function layout(mermaid: string) {
  const data = unwrapDomainResult(await runMermaidPipeline(mermaid));
  return { nodes: data.nodes as Node[], edges: data.edges as Edge[] };
}

const V1 = `graph LR
  web["Web"]
  api["API"]
  db[("Postgres")]
  web --> api
  api --> db`;

describe('publishGraph', () => {
  it('relayouts an empty canvas and attaches componentPaths', async () => {
    const result = publishGraph({ existingNodes: [], laidOut: await layout(V1), componentPaths: { api: ['server/**'], ghost: ['x'] }, now: 1 });
    expect(result.mode).toBe('relayout');
    expect(result.nodes.find((n) => n.id === 'api')?.data.codePaths).toEqual(['server/**']);
    expect(result.unknownPathIds).toEqual(['ghost']);
    expect(result.change.added.map((a) => a.id).sort()).toEqual(['api', 'db', 'web']);
  });

  it('merges into an existing canvas: keeps positions and codePaths, reports the change', async () => {
    const first = publishGraph({ existingNodes: [], laidOut: await layout(V1), componentPaths: { web: ['web/**'] }, now: 1 });
    const moved = first.nodes.map((n) => (n.id === 'web' ? { ...n, position: { x: -500, y: -500 } } : n));
    const v2 = V1.replace('db[("Postgres")]', 'db[("Postgres")]\n  queue["Queue"]').replace('api --> db', 'api --> db\n  api --> queue');

    const second = publishGraph({ existingNodes: moved, laidOut: await layout(v2), now: 2 });
    expect(second.mode).toBe('merge');
    const web = second.nodes.find((n) => n.id === 'web')!;
    expect(web.position).toEqual({ x: -500, y: -500 });
    expect(web.data.codePaths).toEqual(['web/**']);
    expect(second.change).toMatchObject({ added: [{ id: 'queue', label: 'Queue' }], removed: [], renamed: [], at: 2 });
    expect(second.nodes.some((n) => 'absX' in n || 'isGroup' in n)).toBe(false);
  });

  it('relayout keeps existing codePaths unless overridden', async () => {
    const first = publishGraph({ existingNodes: [], laidOut: await layout(V1), componentPaths: { web: ['web/**'], db: ['db/**'] }, now: 1 });
    const again = publishGraph({ existingNodes: first.nodes, laidOut: await layout(V1), componentPaths: { db: ['prisma/**'] }, relayout: true, now: 2 });
    expect(again.nodes.find((n) => n.id === 'web')?.data.codePaths).toEqual(['web/**']);
    expect(again.nodes.find((n) => n.id === 'db')?.data.codePaths).toEqual(['prisma/**']);
  });
});
