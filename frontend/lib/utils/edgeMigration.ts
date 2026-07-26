import type { Edge } from 'reactflow';

/**
 * Normalize legacy `'smooth'` pathType values to the canonical `'Smoothstep'`.
 *
 * This used to be defined twice (once in diagramStore and once in
 * tutorialStore) with the same logic. Both now call this single helper so the
 * normalization rule can't drift between stores.
 */
export function migrateEdgesToSmoothstep<T extends Edge>(edges: T[]): T[] {
  return edges.map((edge) => {
    if (edge.data?.pathType === 'smooth') {
      return { ...edge, data: { ...edge.data, pathType: 'Smoothstep' } };
    }
    return edge;
  });
}