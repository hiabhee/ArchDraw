import type { LayoutParams, LayoutResult } from './LayoutEngine';
import { measureLayoutResult } from './layoutAesthetics';
import { searchColumnOrder } from './columnOrder';
import { foreignNodeIds } from './groupDirections';

/**
 * Column spacing pass, run on the finished layout before `symmetrizeFans`.
 * Dagre aligns every node to the median of its neighbours, so the nodes stacked
 * in one column end up with arbitrary gaps (120px, then 480px, then 240px). Even
 * gaps are what make a column read as a deliberate stack, and a fan's parent is
 * then centered on a regular row of branches by the symmetry pass.
 *
 * Within each column of one group:
 * - the first and last node stay put, so the column's extent (and with it every
 *   group frame, which is sized from its children) never changes;
 * - a node on a straight one-to-one link stays put, so level links stay level;
 * - the nodes between two fixed nodes are spaced with one even gap;
 * - a node that would overlap a node outside the column stays where it is.
 *
 * The order of a column never changes, so edges never start to cross.
 */

const CLEARANCE = 16;
const COLUMN_TOLERANCE = 40;
/** Gaps already this close to even are left alone (avoids pointless jitter). */
const SPREAD_TOLERANCE = 8;
/** The settled layout must take at least this many px off the worst fan or the total miss to be kept over the raw one. */
const MIN_GAIN = 2;

interface Box { id: string; x: number; y: number; w: number; h: number; parent?: string }

export function equalizeColumns(result: LayoutResult, params: LayoutParams): LayoutResult {
  const horizontal = params.direction === 'LR' || params.direction === 'RL';
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));

  const boxes = new Map<string, Box>();
  for (const node of result.nodes) {
    if (groupIds.has(node.id)) continue;
    boxes.set(node.id, {
      id: node.id,
      x: node.x,
      y: node.y,
      w: node.width,
      h: node.height,
      parent: node.parentId && groupIds.has(node.parentId) ? node.parentId : undefined,
    });
  }
  if (boxes.size < 3) return result;

  const start = (box: Box) => (horizontal ? box.y : box.x);
  const span = (box: Box) => (horizontal ? box.h : box.w);
  const along = (box: Box) => (horizontal ? box.x + box.w / 2 : box.y + box.h / 2);
  const cross = (box: Box) => start(box) + span(box) / 2;

  const out = new Map<string, Set<string>>();
  const into = new Map<string, Set<string>>();
  for (const edge of params.edges) {
    if (edge.source === edge.target || !boxes.has(edge.source) || !boxes.has(edge.target)) continue;
    (out.get(edge.source) ?? out.set(edge.source, new Set()).get(edge.source)!).add(edge.target);
    (into.get(edge.target) ?? into.set(edge.target, new Set()).get(edge.target)!).add(edge.source);
  }

  // Nodes on a level one-to-one link: moving one end would bend the link.
  const levelLinked = new Set<string>();
  for (const edge of params.edges) {
    const a = boxes.get(edge.source);
    const b = boxes.get(edge.target);
    if (!a || !b || edge.source === edge.target) continue;
    if (out.get(edge.source)?.size !== 1 || into.get(edge.target)?.size !== 1) continue;
    if (Math.abs(cross(a) - cross(b)) < 1) {
      levelLinked.add(edge.source);
      levelLinked.add(edge.target);
    }
  }

  // Columns: leaves of one group whose centers share a position along the flow. A node in
  // a group laid out the other way has no column here: its flow runs along the other axis.
  const foreign = foreignNodeIds(params);
  const byParent = new Map<string, Box[]>();
  for (const box of boxes.values()) {
    if (foreign.has(box.id)) continue;
    const key = box.parent ?? '';
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(box);
  }
  const columns: Box[][] = [];
  for (const members of byParent.values()) {
    const sorted = [...members].sort((a, b) => along(a) - along(b));
    let current: Box[] = [];
    for (const box of sorted) {
      if (current.length > 0 && along(box) - along(current[0]) > COLUMN_TOLERANCE) {
        columns.push(current);
        current = [];
      }
      current.push(box);
    }
    if (current.length > 0) columns.push(current);
  }

  const overlaps = (a: Box, b: Box) =>
    a.x - CLEARANCE < b.x + b.w && a.x + a.w + CLEARANCE > b.x && a.y - CLEARANCE < b.y + b.h && a.y + a.h + CLEARANCE > b.y;
  const moveTo = (box: Box, value: number): Box => (horizontal ? { ...box, y: value } : { ...box, x: value });

  const moved = new Set<string>();
  for (const column of columns) {
    if (column.length < 3) continue;
    const ordered = [...column].sort((a, b) => start(a) - start(b));
    const columnIds = new Set(ordered.map(box => box.id));
    const gaps = ordered.slice(1).map((box, i) => start(box) - (start(ordered[i]) + span(ordered[i])));
    if (Math.max(...gaps) - Math.min(...gaps) <= SPREAD_TOLERANCE) continue;

    const fixed = ordered.map((box, i) => i === 0 || i === ordered.length - 1 || levelLinked.has(box.id));
    let from = 0;
    for (let i = 1; i < ordered.length; i++) {
      if (!fixed[i]) continue;
      const between = ordered.slice(from + 1, i);
      if (between.length > 0) {
        const lo = start(ordered[from]) + span(ordered[from]);
        const hi = start(ordered[i]);
        const room = hi - lo - between.reduce((sum, box) => sum + span(box), 0);
        const gap = room / (between.length + 1);
        if (gap >= CLEARANCE) {
          let cursor = lo + gap;
          for (const box of between) {
            const next = moveTo(box, cursor);
            cursor += span(box) + gap;
            if (Math.abs(start(next) - start(box)) < 0.5) continue;
            let blocked = false;
            for (const other of boxes.values()) {
              if (columnIds.has(other.id)) continue;
              if (overlaps(next, other)) { blocked = true; break; }
            }
            if (blocked) continue;
            boxes.set(box.id, next);
            moved.add(box.id);
          }
        }
      }
      from = i;
    }
  }

  if (moved.size === 0) return result;
  return {
    ...result,
    nodes: result.nodes.map(node => {
      const box = boxes.get(node.id);
      return box && moved.has(node.id) ? { ...node, x: box.x, y: box.y } : node;
    }),
  };
}

/**
 * Runs the symmetry pass with and without even column spacing and keeps the more
 * orderly layout. Evening a column is not always a win: it can leave a fan's
 * parent unable to center, or split a column between fixed nodes into unequal
 * gaps. Scored with the same measures the aesthetics tests hold templates to; a
 * layout that bends more straight links never wins.
 */
export function settleLayout(
  base: LayoutResult,
  params: LayoutParams,
  symmetrize: (result: LayoutResult, params: LayoutParams) => LayoutResult,
): LayoutResult {
  const settled = searchColumnOrder(settleColumns(base, params, symmetrize), params, symmetrize);
  return helps(settled, base, params) ? settled : base;
}

/**
 * The passes above are free to move anything, and clamping and legalising their
 * answers can leave a few px of disturbance. Where they can't really help (a
 * layout drawn with care, or one already as good as they can make it) that only
 * makes it worse, so the result is used only if it gains something real: more than
 * a couple of px off the worst fan or the total miss, or no edge that was level
 * stops being so. Every edge whose ends are level is drawn without a bend, and the
 * router, and the choice between candidate layouts, pay for bends.
 */
function helps(settled: LayoutResult, base: LayoutResult, params: LayoutParams): boolean {
  const before = measureLayoutResult(base, params);
  const after = measureLayoutResult(settled, params);
  const gains = before.fanErrorTotal - after.fanErrorTotal > MIN_GAIN
    || before.fanCenteringError - after.fanCenteringError > MIN_GAIN;
  const keepsEdgesLevel = after.levelEdges >= before.levelEdges && after.straightEdgeRatio >= before.straightEdgeRatio - 1e-9;
  return gains || keepsEdgesLevel;
}

function settleColumns(
  base: LayoutResult,
  params: LayoutParams,
  symmetrize: (result: LayoutResult, params: LayoutParams) => LayoutResult,
): LayoutResult {
  const plain = symmetrize(base, params);
  const evened = equalizeColumns(base, params);
  if (evened === base) return plain;
  const candidate = symmetrize(evened, params);

  const before = measureLayoutResult(plain, params);
  const after = measureLayoutResult(candidate, params);
  if (after.straightEdgeRatio < before.straightEdgeRatio) return plain;
  return after.fanCenteringError + after.columnSpacingSpread < before.fanCenteringError + before.columnSpacingSpread
    ? candidate
    : plain;
}
