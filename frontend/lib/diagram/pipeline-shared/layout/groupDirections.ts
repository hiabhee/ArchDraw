import type { LayoutParams, RankDirection } from './LayoutEngine';

const isHorizontal = (direction: RankDirection) => direction === 'LR' || direction === 'RL';

/**
 * Nodes that sit inside a group laid out in the other direction (a top-down group in
 * a left-to-right diagram, or the reverse). Their flow runs along the other axis, so
 * the passes that assume one direction for the whole layout (the symmetry solve, even
 * column spacing, the column order search) would read their rows as columns and
 * distort them. Those passes leave these nodes where the layout put them.
 *
 * The nearest group above a node that has a direction of its own decides.
 */
export function foreignNodeIds(params: LayoutParams): Set<string> {
  const groups = new Map(params.nodes.filter(node => node.isGroup).map(node => [node.id, node]));
  const foreign = new Set<string>();
  if (![...groups.values()].some(group => group.direction && isHorizontal(group.direction) !== isHorizontal(params.direction))) return foreign;
  const parentOf = new Map(params.nodes.map(node => [node.id, node.parentId]));
  for (const node of params.nodes) {
    const seen = new Set<string>([node.id]);
    for (let parent = node.parentId; parent && !seen.has(parent); parent = parentOf.get(parent)) {
      seen.add(parent);
      const direction = groups.get(parent)?.direction;
      if (!direction) continue;
      if (isHorizontal(direction) !== isHorizontal(params.direction)) foreign.add(node.id);
      break;
    }
  }
  return foreign;
}
