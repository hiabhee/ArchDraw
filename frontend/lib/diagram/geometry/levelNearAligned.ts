import type { Edge, Node } from 'reactflow';
import { nodeSize } from './nodeBox';

/**
 * Levels nodes joined by an edge that is almost, but not quite, straight.
 *
 * The layout places nodes from the sizes it assumed, but a card is drawn at its
 * own size (a subtitle that wraps makes it taller), so two nodes lined up by their
 * tops end up with centres a few px apart, and the edge between them is drawn
 * with a visible kink. This runs once sizes are measured and nudges one end of
 * such an edge so both centres share a line. It moves a node only when that
 * strictly reduces the misalignment of the edges touching it, never into another
 * node, and never out of its group, so a fan that is centred or a link that is
 * already straight is not disturbed.
 */

/** An edge off-centre by less than this (px) is a slip, not a deliberate offset. */
export const LEVEL_THRESHOLD = 12;
/** Below this the edge already reads as straight. */
const ALREADY_LEVEL = 0.5;
/** Clearance kept from other nodes when a node moves. */
const MARGIN = 8;

export type LevelDirection = 'LR' | 'TD';

const parentOf = (node: Node): string | undefined =>
  node.parentNode ?? (node as { parentId?: string }).parentId;
const isContainer = (node: Node): boolean => node.type === 'groupNode' || node.type === 'group';

interface Box { x: number; y: number; w: number; h: number }

/**
 * New positions (in each node's own frame, like `node.position`) for the nodes
 * that should move. Empty when nothing needs levelling.
 */
export function levelNearAlignedNodes(
  nodes: readonly Node[],
  edges: readonly Edge[],
  direction: LevelDirection,
): Map<string, { x: number; y: number }> {
  const horizontal = direction === 'LR';
  const byId = new Map(nodes.map(node => [node.id, node]));
  const position = new Map(nodes.map(node => [node.id, { x: node.position.x, y: node.position.y }]));
  const size = new Map(nodes.map(node => [node.id, nodeSize(node)]));

  const boxOf = (id: string): Box => {
    const at = position.get(id)!;
    const { width, height } = size.get(id)!;
    return { x: at.x, y: at.y, w: width, h: height };
  };
  const crossCentre = (id: string) => {
    const b = boxOf(id);
    return horizontal ? b.y + b.h / 2 : b.x + b.w / 2;
  };
  const alongCentre = (id: string) => {
    const b = boxOf(id);
    return horizontal ? b.x + b.w / 2 : b.y + b.h / 2;
  };
  const alongHalf = (id: string) => (horizontal ? size.get(id)!.width : size.get(id)!.height) / 2;

  /** Two nodes of one group that face each other along the flow (side by side, not stacked). */
  const facing = (a: string, b: string) => Math.abs(alongCentre(a) - alongCentre(b)) > alongHalf(a) + alongHalf(b);
  const comparable = (a: string, b: string) => {
    const na = byId.get(a), nb = byId.get(b);
    return Boolean(na && nb && a !== b && !isContainer(na) && !isContainer(nb) && parentOf(na) === parentOf(nb));
  };

  const incident = new Map<string, Edge[]>();
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) (incident.get(id) ?? incident.set(id, []).get(id)!).push(edge);
  }
  /** How far the edges touching `id` are from level, if `id` sat at `cross`. */
  const misalignment = (id: string, cross: number) => {
    let total = 0;
    for (const edge of incident.get(id) ?? []) {
      const other = edge.source === id ? edge.target : edge.source;
      if (!comparable(id, other) || !facing(id, other)) continue;
      total += Math.abs(crossCentre(other) - cross);
    }
    return total;
  };

  const overlaps = (a: Box, b: Box) =>
    a.x - MARGIN < b.x + b.w && a.x + a.w + MARGIN > b.x && a.y - MARGIN < b.y + b.h && a.y + a.h + MARGIN > b.y;

  const candidates = edges
    .filter(edge => comparable(edge.source, edge.target) && facing(edge.source, edge.target))
    .map(edge => ({ edge, gap: Math.abs(crossCentre(edge.target) - crossCentre(edge.source)) }))
    .filter(({ gap }) => gap > ALREADY_LEVEL && gap < LEVEL_THRESHOLD)
    .sort((a, b) => a.gap - b.gap);

  const moved = new Set<string>();
  for (const { edge } of candidates) {
    const gap = crossCentre(edge.target) - crossCentre(edge.source);
    if (Math.abs(gap) <= ALREADY_LEVEL || Math.abs(gap) >= LEVEL_THRESHOLD) continue; // an earlier move settled it

    // Move the end with fewer edges (the lighter node), the target on a tie.
    const sourceLoad = incident.get(edge.source)?.length ?? 0;
    const targetLoad = incident.get(edge.target)?.length ?? 0;
    const mover = sourceLoad < targetLoad ? edge.source : edge.target;
    if (moved.has(mover)) continue;
    const shift = mover === edge.target ? -gap : gap;

    const here = crossCentre(mover);
    if (misalignment(mover, here + shift) >= misalignment(mover, here) - ALREADY_LEVEL) continue;

    const before = boxOf(mover);
    const after: Box = horizontal ? { ...before, y: before.y + shift } : { ...before, x: before.x + shift };
    const parent = parentOf(byId.get(mover)!);
    let blocked = false;
    for (const other of nodes) {
      if (other.id === mover || isContainer(other) || parentOf(other) !== parent) continue;
      if (overlaps(after, boxOf(other.id)) && !overlaps(before, boxOf(other.id))) { blocked = true; break; }
    }
    if (blocked) continue;
    if (parent && byId.has(parent)) {
      const frame = size.get(parent)!;
      if (after.x < 0 || after.y < 0 || after.x + after.w > frame.width || after.y + after.h > frame.height) continue;
    }

    position.set(mover, { x: after.x, y: after.y });
    moved.add(mover);
  }

  return new Map([...moved].map(id => [id, position.get(id)!]));
}
