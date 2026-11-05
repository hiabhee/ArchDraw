import type { LayoutParams, LayoutResult } from './LayoutEngine';
import { measureLayoutResult } from './layoutAesthetics';
import { foreignNodeIds } from './groupDirections';

/**
 * Column order search, run last on every layout. Dagre picks the order of the
 * nodes in a column once, to minimise crossings. Symmetry then can't move a node
 * past its neighbour, so a fan whose parent is pinned between two others stays
 * off-centre however the solver weighs it. This pass lets the order change when
 * that makes the diagram more orderly:
 *
 * - candidates are swaps of two neighbouring nodes of one group's column that
 *   have the same size (so no frame, gap or clearance changes);
 * - each candidate is re-solved by the symmetry pass and scored with the same
 *   measure the tests use (fan misses, column evenness, straight links) plus a
 *   penalty per edge crossing;
 * - a swap is kept only if it adds no crossing and lowers the score.
 *
 * It repeats until no swap helps, within a fixed evaluation budget so the cost
 * is bounded and the result is deterministic.
 */

const COLUMN_TOLERANCE = 40;
/** One crossing weighs as much as this many px of fan miss. */
const CROSSING_PX = 150;
/** One missing straight link (as a share of all) weighs this many px. */
const STRAIGHT_PX = 400;
/** Extra weight on the single worst fan miss. */
const WORST_FAN_WEIGHT = 2;
/** A swap must gain at least this much to be kept. */
const MIN_GAIN = 1;
/** Layouts with more nodes than this are left as they are. */
const MAX_NODES = 140;
/** Symmetry solves one search may spend on a small diagram. */
const MAX_EVALUATIONS = 500;
/** Total work cap: evaluations are limited to this divided by (node count)², since each solve grows with the diagram. */
const WORK_BUDGET = 250_000;
/** A fan this far off-centre (px) is worth trying to repair. */
const FAN_TOLERANCE = 1;

type Symmetrize = (result: LayoutResult, params: LayoutParams) => LayoutResult;

export function searchColumnOrder(base: LayoutResult, params: LayoutParams, symmetrize: Symmetrize): LayoutResult {
  const horizontal = params.direction === 'LR' || params.direction === 'RL';
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  // Nodes in a group laid out the other way are not in these columns: their flow runs along the other axis.
  const foreign = foreignNodeIds(params);
  const leafCount = base.nodes.filter(node => !groupIds.has(node.id)).length;
  if (leafCount < 4 || leafCount > MAX_NODES) return base;

  const start = (node: LayoutResult['nodes'][number]) => (horizontal ? node.y : node.x);
  const size = (node: LayoutResult['nodes'][number]) => (horizontal ? node.height : node.width);
  const along = (node: LayoutResult['nodes'][number]) => (horizontal ? node.x + node.width / 2 : node.y + node.height / 2);

  const crossings = (result: LayoutResult, involved?: Set<string>): number => {
    const byId = new Map(result.nodes.map(node => [node.id, node]));
    const column = columnsOf(result);
    const columnOf = new Map<string, string>();
    for (const [key, ids] of column) for (const id of ids) columnOf.set(id, key);
    const edges = params.edges.filter(edge => byId.has(edge.source) && byId.has(edge.target) && !groupIds.has(edge.source) && !groupIds.has(edge.target) && !foreign.has(edge.source) && !foreign.has(edge.target) && edge.source !== edge.target);
    const centre = (id: string) => start(byId.get(id)!) + size(byId.get(id)!) / 2;
    let count = 0;
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const a = edges[i], b = edges[j];
        if (columnOf.get(a.source) !== columnOf.get(b.source) || columnOf.get(a.target) !== columnOf.get(b.target)) continue;
        if (a.source === b.source || a.target === b.target) continue;
        const s = centre(a.source) - centre(b.source);
        const t = centre(a.target) - centre(b.target);
        if (s * t < 0) {
          count++;
          involved?.add(a.source).add(a.target).add(b.source).add(b.target);
        }
      }
    }
    return count;
  };

  /** Columns: leaves of one group whose centres are close along the flow, each listed top to bottom. */
  function columnsOf(result: LayoutResult): Map<string, string[]> {
    const byParent = new Map<string, LayoutResult['nodes']>();
    for (const node of result.nodes) {
      if (groupIds.has(node.id) || foreign.has(node.id)) continue;
      const key = node.parentId && groupIds.has(node.parentId) ? node.parentId : '';
      (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(node);
    }
    const columns = new Map<string, string[]>();
    for (const [parent, members] of byParent) {
      const sorted = [...members].sort((a, b) => along(a) - along(b));
      let index = -1;
      let last = -Infinity;
      const groups = new Map<number, LayoutResult['nodes']>();
      for (const node of sorted) {
        if (along(node) - last > COLUMN_TOLERANCE) index++;
        last = along(node);
        (groups.get(index) ?? groups.set(index, []).get(index)!).push(node);
      }
      for (const [i, nodes] of groups) columns.set(`${parent}\u0000${i}`, nodes.sort((a, b) => start(a) - start(b)).map(node => node.id));
    }
    return columns;
  }

  /**
   * Nodes worth moving: those in a fan that is off-centre (the parent and its
   * branches) and those on a crossing. A layout with none is left untouched, and
   * the search never spends solves on parts that are already orderly.
   */
  const problemNodes = (result: LayoutResult): Set<string> => {
    const byId = new Map(result.nodes.map(node => [node.id, node]));
    const leaves = result.nodes.filter(node => !groupIds.has(node.id) && !foreign.has(node.id));
    const sorted = [...leaves].sort((a, b) => along(a) - along(b));
    const columnIndex = new Map<string, number>();
    let index = -1;
    let last = -Infinity;
    for (const node of sorted) {
      if (along(node) - last > COLUMN_TOLERANCE) index++;
      last = along(node);
      columnIndex.set(node.id, index);
    }
    const out = new Map<string, string[]>();
    const into = new Map<string, string[]>();
    for (const edge of params.edges) {
      if (edge.source === edge.target || !byId.has(edge.source) || !byId.has(edge.target)) continue;
      if (groupIds.has(edge.source) || groupIds.has(edge.target) || foreign.has(edge.source) || foreign.has(edge.target)) continue;
      const forward = along(byId.get(edge.target)!) > along(byId.get(edge.source)!);
      if (forward && columnIndex.get(edge.target)! - columnIndex.get(edge.source)! > 1) continue; // skips columns: not a branch
      (out.get(edge.source) ?? out.set(edge.source, []).get(edge.source)!).push(edge.target);
      (into.get(edge.target) ?? into.set(edge.target, []).get(edge.target)!).push(edge.source);
    }
    const centre = (id: string) => start(byId.get(id)!) + size(byId.get(id)!) / 2;
    const marked = new Set<string>();
    const check = (id: string, branches: string[] | undefined) => {
      if (!branches || branches.length < 2) return;
      const mean = branches.reduce((sum, other) => sum + centre(other), 0) / branches.length;
      if (Math.abs(centre(id) - mean) <= FAN_TOLERANCE) return;
      marked.add(id);
      for (const other of branches) marked.add(other);
    };
    for (const node of leaves) {
      check(node.id, out.get(node.id));
      check(node.id, into.get(node.id));
    }
    crossings(result, marked);
    return marked;
  };

  const score = (result: LayoutResult): number => {
    const m = measureLayoutResult(result, params);
    // The worst fan counts on top of the total, so one big miss is never traded for several small ones.
    return m.fanErrorTotal + m.fanCenteringError * WORST_FAN_WEIGHT + m.columnSpacingSpread * 0.25 + (1 - m.straightEdgeRatio) * STRAIGHT_PX + crossings(result) * CROSSING_PX;
  };

  /** The column with `ids[i]` and `ids[i + 1]` exchanged, keeping every slot and gap. */
  const swapped = (result: LayoutResult, ids: string[], i: number): LayoutResult | null => {
    const byId = new Map(result.nodes.map(node => [node.id, node]));
    const a = byId.get(ids[i])!, b = byId.get(ids[i + 1])!;
    if (Math.abs(size(a) - size(b)) > 0.5) return null;
    const gap = start(b) - (start(a) + size(a));
    const top = start(a);
    const place = new Map<string, number>([[b.id, top], [a.id, top + size(b) + gap]]);
    return {
      ...result,
      nodes: result.nodes.map(node => {
        const value = place.get(node.id);
        if (value === undefined) return node;
        return horizontal ? { ...node, y: value } : { ...node, x: value };
      }),
    };
  };

  let best = base;
  let bestScore = score(base);
  let bestCrossings = crossings(base);
  let evaluations = 0;
  const budget = Math.min(MAX_EVALUATIONS, Math.max(8, Math.floor(WORK_BUDGET / (leafCount * leafCount))));

  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    const worthMoving = problemNodes(best);
    if (worthMoving.size === 0) break;
    for (const ids of columnsOf(best).values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length - 1; i++) {
        if (!worthMoving.has(ids[i]) && !worthMoving.has(ids[i + 1])) continue;
        if (evaluations >= budget) return best;
        const moved = swapped(best, ids, i);
        if (!moved) continue;
        evaluations++;
        const candidate = symmetrize(moved, params);
        const candidateCrossings = crossings(candidate);
        if (candidateCrossings > bestCrossings) continue;
        const candidateScore = score(candidate);
        if (candidateScore < bestScore - MIN_GAIN) {
          best = candidate;
          bestScore = candidateScore;
          bestCrossings = candidateCrossings;
          improved = true;
          break; // the column changed: re-read it
        }
      }
      if (improved) break;
    }
    if (!improved) break;
  }
  return best;
}
