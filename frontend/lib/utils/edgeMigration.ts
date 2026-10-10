import type { Edge } from 'reactflow';

/**
 * Normalize legacy `'smooth'` pathType values to the canonical `'Smoothstep'`,
 * and drop legacy pipeline-written async dashes (`'5,5'`) so pre-existing
 * canvases pick up the solid-by-default rule (dash is now resolved from
 * edgeVariant / importance / explicit edge type instead).
 *
 * This used to be defined twice (once in diagramStore and once in
 * tutorialStore) with the same logic. Both now call this single helper so the
 * normalization rule can't drift between stores.
 */
export function migrateEdgesToSmoothstep<T extends Edge>(edges: T[]): T[] {
  return edges.map((edge) => {
    let next = edge;
    if (edge.data?.pathType === 'smooth') {
      next = { ...next, data: { ...next.data, pathType: 'Smoothstep' } };
    }
    const dash = (next.style as { strokeDasharray?: unknown } | undefined)?.strokeDasharray;
    if (typeof dash === 'string' && dash.replace(/\s+/g, '') === '5,5') {
      const { strokeDasharray: _removed, ...restStyle } = next.style as Record<string, unknown>;
      next = { ...next, style: restStyle };
    }
    return next;
  });
}