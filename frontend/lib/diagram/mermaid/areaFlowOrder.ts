import type { RFObjects } from './types';

/**
 * When the caller wrote its top-level subgraphs in the order data flows
 * (project maps: sources → ingest → … → presentation), an edge from a later
 * area back to an earlier one is feedback. Marking it so keeps it out of
 * Dagre's ranking: loops between areas otherwise get broken arbitrarily and
 * an early stage can land at the far end of the diagram. The edge still
 * renders. Opt-in, because other Mermaid sources list groups in any order.
 * `order` (area ids, upstream first) overrides the declaration order, e.g.
 * the overview's left-to-right order for its detailed map.
 */
export function markBackwardAreaEdges(objects: RFObjects, order?: readonly string[]): RFObjects {
  const parentOf = new Map<string, string>();
  for (const node of objects.nodes) {
    if (node.parentNode) parentOf.set(node.id, node.parentNode);
  }
  const areaOf = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (parentOf.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parentOf.get(current)!;
    }
    return current;
  };
  // Groups are built in declaration order; top-level ones are the areas.
  const declared = objects.nodes.filter((node) => node.type === 'groupNode' && !node.parentNode).map((node) => node.id);
  const ranked = order
    ? [...order.filter((id) => declared.includes(id)), ...declared.filter((id) => !order.includes(id))]
    : declared;
  const areaIndex = new Map(ranked.map((id, index) => [id, index]));
  if (areaIndex.size < 2) return objects;

  return {
    ...objects,
    edges: objects.edges.map((edge) => {
      const from = areaIndex.get(areaOf(edge.source));
      const to = areaIndex.get(areaOf(edge.target));
      if (from === undefined || to === undefined || from <= to) return edge;
      return { ...edge, data: { ...edge.data, flowRole: 'feedback', flowRoleSource: 'explicit' } };
    }),
  };
}
