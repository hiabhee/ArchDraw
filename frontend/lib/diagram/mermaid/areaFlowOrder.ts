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
/**
 * A move is made only when it takes at least this many edges off the backward count. One backward
 * edge is ordinary feedback (a loop in a sensible flow), and moving an area to save it would break a
 * declared flow; several edges all pointing backward mean the areas were declared in the wrong order.
 */
export const MIN_AREA_ORDER_GAIN = 2;

/**
 * The order of `declared` areas that sends fewer edges backwards, found by moving one area at a time
 * to the place that most reduces the backward edges (ties: the smallest move). An area moves only
 * when that removes at least `MIN_AREA_ORDER_GAIN` backward edges, so an order that is already
 * flow-correct, or has only ordinary feedback, is returned unchanged. `links` is the number of
 * edges from one area to another.
 */
export function improveAreaOrder(declared: readonly string[], links: ReadonlyMap<string, number>): string[] {
  const weight = (from: string, to: string) => links.get(`${from}\u0000${to}`) ?? 0;
  const backward = (order: readonly string[]) => {
    let total = 0;
    for (let i = 0; i < order.length; i++) for (let j = 0; j < i; j++) total += weight(order[i], order[j]);
    return total;
  };
  const displacement = (order: readonly string[]) => order.reduce((sum, id, i) => sum + Math.abs(i - declared.indexOf(id)), 0);
  let current = [...declared];
  for (let round = 0; round < declared.length * 2; round++) {
    let best: string[] | undefined;
    const currentBackward = backward(current);
    let bestBackward = currentBackward - MIN_AREA_ORDER_GAIN + 1;
    let bestDisplacement = Infinity;
    for (const id of current) {
      const rest = current.filter((other) => other !== id);
      for (let at = 0; at <= rest.length; at++) {
        const moved = [...rest.slice(0, at), id, ...rest.slice(at)];
        const score = backward(moved);
        const move = displacement(moved);
        if (score < bestBackward || (best && score === bestBackward && move < bestDisplacement)) {
          best = moved;
          bestBackward = score;
          bestDisplacement = move;
        }
      }
    }
    if (!best) break;
    current = best;
  }
  return current;
}

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
  let ranked: string[];
  if (order) {
    ranked = [...order.filter((id) => declared.includes(id)), ...declared.filter((id) => !order.includes(id))];
  } else {
    // Declaration order is the starting point (callers usually write areas in flow order), but
    // areas declared in an order that makes many edges run backwards are put right.
    const links = new Map<string, number>();
    for (const edge of objects.edges) {
      const from = areaOf(edge.source);
      const to = areaOf(edge.target);
      if (from !== to && declared.includes(from) && declared.includes(to)) links.set(`${from}\u0000${to}`, (links.get(`${from}\u0000${to}`) ?? 0) + 1);
    }
    ranked = improveAreaOrder(declared, links);
  }
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
