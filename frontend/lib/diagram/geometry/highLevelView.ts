import type { Edge, Node } from 'reactflow';

/**
 * High-level view: each top-level group collapses into one component and the
 * edges between groups merge into one per connected pair. A read-only
 * projection — the stored diagram is never changed.
 */

const COLLAPSIBLE_TYPES = new Set(['groupNode', 'shapeNode', 'systemNode']);

function parentOf(node: Node): string | undefined {
  return node.parentNode ?? (node as Node & { parentId?: string }).parentId ?? undefined;
}

export function hasHighLevelView(nodes: readonly Node[]): boolean {
  return nodes.some((node) => node.type === 'groupNode' && !parentOf(node));
}

/** Null when there is nothing to collapse (no top-level groups). */
export function buildHighLevelGraph(nodes: readonly Node[], edges: readonly Edge[]): { nodes: Node[]; edges: Edge[] } | null {
  if (!hasHighLevelView(nodes)) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const ownerCache = new Map<string, string | undefined>();
  const topLevelOwner = (id: string): string | undefined => {
    if (ownerCache.has(id)) return ownerCache.get(id);
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && parentOf(current) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(parentOf(current)!);
    }
    const owner = current && COLLAPSIBLE_TYPES.has(current.type ?? '') ? current.id : undefined;
    ownerCache.set(id, owner);
    return owner;
  };

  const memberCount = new Map<string, number>();
  for (const node of nodes) {
    if (node.type === 'groupNode' || !parentOf(node)) continue;
    const owner = topLevelOwner(node.id);
    if (owner) memberCount.set(owner, (memberCount.get(owner) ?? 0) + 1);
  }

  const summaryNodes: Node[] = [];
  for (const node of nodes) {
    if (parentOf(node) || !COLLAPSIBLE_TYPES.has(node.type ?? '')) continue;
    const data = (node.data ?? {}) as Record<string, unknown>;
    if (node.type !== 'groupNode') {
      summaryNodes.push({ id: node.id, type: node.type, position: { x: 0, y: 0 }, data });
      continue;
    }
    const count = memberCount.get(node.id) ?? 0;
    summaryNodes.push({
      id: node.id,
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: {
        label: data.label ?? node.id,
        subtitle: `${count} component${count === 1 ? '' : 's'}`,
        shape: 'rounded-rectangle',
        ...(data.color ? { color: data.color } : {}),
        ...(data.category ? { category: data.category } : {}),
        // The group's code paths, if any, keep live activity on the summary.
        ...(data.codePaths ? { codePaths: data.codePaths } : {}),
      },
    });
  }

  const merged = new Map<string, { edge: Edge; count: number }>();
  for (const edge of edges) {
    const source = topLevelOwner(edge.source);
    const target = topLevelOwner(edge.target);
    if (!source || !target || source === target) continue;
    const key = `${source}->${target}`;
    const existing = merged.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    merged.set(key, {
      count: 1,
      edge: {
        id: `high-level:${key}`,
        source,
        target,
        type: edge.type,
        // Hand-drawn routing belongs to the full view.
        data: { ...(edge.data ?? {}), customWaypoints: undefined, sourceSide: undefined, targetSide: undefined },
      },
    });
  }
  const summaryEdges = [...merged.values()].map(({ edge, count }) =>
    count > 1 ? { ...edge, data: { ...edge.data, label: `${count} connections` } } : edge,
  );

  return { nodes: summaryNodes, edges: summaryEdges };
}
