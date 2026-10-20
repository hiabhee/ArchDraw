/**
 * The project canvas is the overview (high-level design): 8–16 components.
 * A fine-grained map published there makes Overview look like the detailed
 * map, so the publish response warns and points at the detailed level.
 */

import { isTextNode } from '@/lib/diagram/pipeline-shared/textNodes';

const GROUP_TYPES = new Set(['groupNode', 'group', 'frameNode']);

/** Leaf components above this read as a detailed map, not an overview. */
export const MAX_OVERVIEW_COMPONENTS = 20;

interface SizedNode {
  id: string;
  type?: string;
}

export function overviewSizeWarning(nodes: readonly SizedNode[]): string | null {
  const leaves = nodes.filter((n) => !GROUP_TYPES.has(n.type ?? '') && !isTextNode(n)).length;
  if (leaves <= MAX_OVERVIEW_COMPONENTS) return null;
  return (
    `This overview has ${leaves} components; an overview should have 8–16 (one per real part of the system, small helpers merged in). ` +
    'Publish a smaller overview, and put the fine-grained map in the detailed map (level: "detail", parts as <component>__<part> inside the overview ids).'
  );
}
