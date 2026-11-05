import type { LayoutParams, LayoutResult } from './LayoutEngine';
import { foreignNodeIds } from './groupDirections';

/**
 * Symmetry pass, run on the finished layout of every diagram (flat and
 * grouped). Dagre places a node near the median of its neighbours, so a fan-out
 * or fan-in is often lopsided: one short branch, two long ones. Earlier versions
 * nudged one fan at a time, and each nudge undid its neighbours. This pass
 * solves for every position at once instead:
 *
 * - each fan centres its parent on the mean of its branches (fan-out: the
 *   children; fan-in: the sources),
 * - each straight one-to-one link keeps its two ends level,
 * - a weak anchor keeps every node near where Dagre put it.
 *
 * Minimising that energy is a linear least-squares problem, solved exactly.
 * Its answer is then applied only as far as it stays safe: a node never
 * overlaps another, never changes order in its column, and never leaves its
 * group's frame (a loose node may move, but never into a group's frame). If the
 * full answer is unsafe, the pass applies a fraction of the move that is safe.
 * When no fraction is safe because one node sits at its group's edge, a second
 * solve makes each group's range a bound of the system (see `balanceFans`), so
 * the other nodes adjust to that node instead of the whole move being dropped.
 *
 * Fans whose branches sit in different groups are left alone: no single
 * position is centered for both. Interlocking fans (a node whose parent and
 * branches are each other's branches) contradict one another, so the solve
 * returns the least-squares compromise; no layout can centre all of them.
 */

const CLEARANCE = 16;
const COLUMN_TOLERANCE = 40;
/** Weight of the anchor to Dagre's positions. Small, so fans and links win. */
const ANCHOR = 1e-4;
/** Weight of a fan's centring row: a strong constraint, so fans are centred wherever they can be. */
const FAN_WEIGHT = 1e3;
/** Weight of one-to-one links kept level. */
const LINK_WEIGHT = 0.5;
/** A chain must overshoot its group's range by more than this (px) to be held at the bound. */
const BOUND_TOLERANCE = 0.6;
/** Weight that holds a chain at a bound of its group's range. */
const PIN = 1e6;
/** Passes of pairwise push-apart that make the solved centres clear of each other. */
const LEGALIZE_PASSES = 500;
const LEGAL_EPSILON = 0.01;
/** Fractions of the solved move to try, from the full answer down. */
const FRACTIONS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1] as const;

interface Box { id: string; x: number; y: number; w: number; h: number; parent?: string }

/**
 * Balances every fan and one-to-one link in one solve, then applies the result
 * only where every node stays safe (see `balanceFans`).
 */
export function symmetrizeFans(result: LayoutResult, params: LayoutParams): LayoutResult {
  return balanceFans(result, params);
}

/** One attempt: the layout it produced and the largest fraction of the solved move that was safe (0 = none applied). */
interface Attempt { result: LayoutResult; fraction: number }

/**
 * The solve runs twice at most. The first attempt is the plain one: group ranges
 * are only checked after the solve, so a node that would leave its group rejects
 * the whole move at every fraction. Whatever that attempt applies is kept as it
 * is. Only when it applies nothing (some node sits at its group's edge and the
 * solution wants it outside) does the second attempt run, which makes each
 * group's range a bound of the solve itself, so the rest of the layout adjusts to
 * it instead of being thrown out for one node.
 */
function balanceFans(result: LayoutResult, params: LayoutParams): LayoutResult {
  const plain = balance(result, params, false);
  if (plain.fraction > 0) return plain.result;
  return balance(result, params, true).result;
}

function balance(result: LayoutResult, params: LayoutParams, useBounds: boolean): Attempt {
  const horizontal = params.direction === 'LR' || params.direction === 'RL';
  // Which way the flow runs along the axis (RL / BT run toward smaller coordinates).
  const flow = params.direction === 'RL' || params.direction === 'BT' ? -1 : 1;
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
  if (boxes.size < 3) return { result, fraction: 0 };

  const cross = (box: Box) => (horizontal ? box.y + box.h / 2 : box.x + box.w / 2);
  const along = (box: Box) => (horizontal ? box.x + box.w / 2 : box.y + box.h / 2);
  const span = (box: Box) => (horizontal ? box.h : box.w);

  // Ranks: nodes whose positions along the flow agree share a column.
  const rank = new Map<string, number>();
  {
    const sorted = [...boxes.values()].sort((a, b) => along(a) * flow - along(b) * flow);
    let current = -1;
    let last = -Infinity;
    for (const box of sorted) {
      if (along(box) * flow - last > COLUMN_TOLERANCE) current++;
      rank.set(box.id, current);
      last = along(box) * flow;
    }
  }

  // Solver variables are the boxes only. An edge that skips a column is not a
  // fan branch: its ends do not centre on each other, the router draws it past
  // the nodes in between. Only edges between neighbouring columns (or inside one
  // column) define fans and links.
  const variables = new Map<string, { id: string; box: Box; parent?: string; along: number; cross: number }>();
  for (const box of boxes.values()) {
    variables.set(box.id, { id: box.id, box, parent: box.parent, along: along(box), cross: cross(box) });
  }
  const edges: Array<[string, string]> = [];
  for (const edge of params.edges) {
    if (edge.source === edge.target || !boxes.has(edge.source) || !boxes.has(edge.target)) continue;
    const s = boxes.get(edge.source)!, t = boxes.get(edge.target)!;
    const skipped = rank.get(edge.target)! - rank.get(edge.source)!;
    const forward = (along(t) - along(s)) * flow > 0;
    if (forward && skipped > 1 && s.parent === t.parent) continue;
    edges.push([edge.source, edge.target]);
  }

  const out = new Map<string, Set<string>>();
  const into = new Map<string, Set<string>>();
  for (const [source, target] of edges) {
    (out.get(source) ?? out.set(source, new Set()).get(source)!).add(target);
    (into.get(target) ?? into.set(target, new Set()).get(target)!).add(source);
  }

  // A group's frame is drawn around its children, so they may only move inside
  // the cross-axis range they already cover.
  const range = new Map<string, { lo: number; hi: number }>();
  for (const box of boxes.values()) {
    if (!box.parent) continue;
    const lo = horizontal ? box.y : box.x;
    const hi = lo + span(box);
    const current = range.get(box.parent);
    range.set(box.parent, current ? { lo: Math.min(current.lo, lo), hi: Math.max(current.hi, hi) } : { lo, hi });
  }

  /** The centres a box may take: anywhere for a loose node, inside the group's range for a child. */
  const centreInterval = (box: Box) => {
    if (!box.parent) return { lo: -Infinity, hi: Infinity };
    const frame = range.get(box.parent)!;
    return { lo: frame.lo + span(box) / 2, hi: frame.hi - span(box) / 2 };
  };

  // One-to-one links are chained (the two ends are one variable, so the link is
  // exactly level), within a group or across groups, as long as their allowed
  // ranges overlap. A pair whose ranges don't overlap is held level softly.
  const oneToOne: Array<[string, string]> = [];
  const crossLinks: Array<[string, string]> = [];
  for (const [source, targets] of out) {
    if (targets.size !== 1) continue;
    const [target] = targets;
    if (into.get(target)?.size !== 1) continue;
    const a = variables.get(source)!, b = variables.get(target)!;
    const ia = centreInterval(a.box), ib = centreInterval(b.box);
    if (a.parent === b.parent || (useBounds && Math.max(ia.lo, ib.lo) <= Math.min(ia.hi, ib.hi))) oneToOne.push([source, target]);
    else crossLinks.push([source, target]);
  }

  // Fan rows: centre minus the mean of its branches. A fan counts when every
  // branch lies ahead of its parent along the flow and they share one group.
  const rows: Array<Array<[string, number]>> = [];
  const addFan = (id: string, branches: Set<string> | undefined, sign: 1 | -1) => {
    if (!branches || branches.size < 2) return;
    const members = [...branches].map(other => variables.get(other)!);
    const parent = variables.get(id)!;
    if (!members.every(other => (other.along - parent.along) * sign * flow > 0)) return;
    if (new Set(members.map(other => other.parent)).size > 1) return;
    const share = 1 / members.length;
    rows.push([[id, 1], ...members.map(other => [other.id, -share] as [string, number])]);
  };
  for (const id of variables.keys()) {
    addFan(id, out.get(id), 1);
    addFan(id, into.get(id), -1);
  }
  if (rows.length === 0 && oneToOne.length === 0 && crossLinks.length === 0) return { result, fraction: 0 };

  // Each straight chain of one-to-one links is one variable: its members share a
  // centre, so every link in it is exactly level.
  const parentOfChain = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parentOfChain.has(root)) root = parentOfChain.get(root)!;
    return root;
  };
  for (const [source, target] of oneToOne) {
    const a = find(source), b = find(target);
    if (a !== b) parentOfChain.set(b, a);
  }
  const ids = [...variables.keys()];
  const chains = [...new Set(ids.map(find))];
  const index = new Map(chains.map((root, i) => [root, i]));
  const variableOf = (id: string) => index.get(find(id))!;
  const n = chains.length;
  const members = new Map<number, string[]>();
  for (const id of ids) {
    const v = variableOf(id);
    (members.get(v) ?? members.set(v, []).get(v)!).push(id);
  }
  const c0 = chains.map((_, v) => {
    const ms = members.get(v)!;
    return ms.reduce((sum, id) => sum + variables.get(id)!.cross, 0) / ms.length;
  });

  // A node inside a group laid out the other way keeps the place the layout gave it.
  const foreign = foreignNodeIds(params);
  const pinned = chains.map((_, v) => members.get(v)!.some(id => foreign.has(id)));
  const matrix = Array.from({ length: n }, (_, v) => {
    const row = new Float64Array(n);
    row[v] = pinned[v] ? PIN : ANCHOR;
    return row;
  });
  const rhs = Float64Array.from(c0, (value, v) => (pinned[v] ? PIN : ANCHOR) * value);
  const addRow = (terms: Array<[string, number]>, weight = 1, constant = 0) => {
    // Accumulate per variable: a chain can appear on both sides of one fan.
    const coefficient = new Map<number, number>();
    for (const [id, value] of terms) {
      const v = variableOf(id);
      coefficient.set(v, (coefficient.get(v) ?? 0) + value);
    }
    for (const [a, va] of coefficient) {
      for (const [b, vb] of coefficient) matrix[a][b] += weight * va * vb;
      rhs[a] += weight * va * constant;
    }
  };
  for (const row of rows) addRow(row, FAN_WEIGHT);
  for (const [source, target] of crossLinks) {
    // A link across groups stays level as strongly as a fan centres.
    if (variableOf(source) !== variableOf(target)) addRow([[source, 1], [target, -1]], FAN_WEIGHT);
  }

  // Nodes in one column keep their clearance. A pair that would be too close is
  // held at exactly the clearance by a strong equality row; the solve repeats
  // until no new pair is too close.
  const boxIds = [...boxes.keys()];
  const pairs = [] as Array<{ a: string; b: string; sign: number; need: number }>;
  for (let i = 0; i < boxIds.length; i++) {
    for (let j = i + 1; j < boxIds.length; j++) {
      const a = boxes.get(boxIds[i])!, b = boxes.get(boxIds[j])!;
      if (variableOf(a.id) === variableOf(b.id)) continue;
      const alongGap = Math.abs(along(a) - along(b));
      const alongNeed = (horizontal ? a.w + b.w : a.h + b.h) / 2 + CLEARANCE;
      if (alongGap >= alongNeed) continue;
      const crossGap = cross(b) - cross(a);
      pairs.push({ a: a.id, b: b.id, sign: crossGap >= 0 ? 1 : -1, need: (span(a) + span(b)) / 2 + CLEARANCE + 1 });
    }
  }
  const SEPARATION = 1e3;
  // A chain inside a group may not leave the cross-axis range its group covers
  // (the frame is drawn around the children), so each has bounds on its centre.
  // Bounds join the solve as an active set: a chain that lands outside is held at
  // the bound and the system is solved again, so every other node adjusts to it
  // instead of the whole answer being thrown out for one node.
  const bounds = chains.map((_, v) => {
    let lo = -Infinity, hi = Infinity;
    if (!useBounds) return { lo, hi };
    for (const id of members.get(v)!) {
      const box = boxes.get(id)!;
      if (!box.parent) continue;
      const frame = range.get(box.parent)!;
      lo = Math.max(lo, frame.lo + span(box) / 2);
      hi = Math.min(hi, frame.hi - span(box) / 2);
    }
    // Members whose ranges don't overlap can't move together: the chain stays put.
    return lo <= hi ? { lo, hi } : { lo: c0[v], hi: c0[v] };
  });
  const held = new Map<number, number>();
  const active = new Set<number>();
  let solved: Float64Array | null = null;
  const baseMatrix = matrix.map(row => Float64Array.from(row));
  const baseRhs = Float64Array.from(rhs);
  for (let round = 0; round < (useBounds ? 24 : 12); round++) {
    for (let i = 0; i < n; i++) matrix[i].set(baseMatrix[i]);
    rhs.set(baseRhs);
    for (const k of active) {
      const { a, b, sign, need } = pairs[k];
      addRow([[b, sign], [a, -sign]], SEPARATION, need);
    }
    for (const [v, value] of held) {
      matrix[v][v] += PIN;
      rhs[v] += PIN * value;
    }
    solved = solve(matrix, rhs);
    if (!solved) return { result, fraction: 0 };
    let grew = false;
    pairs.forEach((pair, k) => {
      if (active.has(k)) return;
      const gap = pair.sign * (solved![variableOf(pair.b)] - solved![variableOf(pair.a)]);
      if (gap < pair.need - 0.5) { active.add(k); grew = true; }
    });
    // Bounds are judged only once the clearance rows have settled. Before that the
    // fans may pile onto each other and overshoot a group's edge, and a hold added
    // then would pin the node there for good.
    if (!grew) {
      solved.forEach((value, v) => {
        if (held.has(v)) return;
        // A sub-pixel overshoot (the clearance rows keep 1px of margin) is just clamped later.
        if (value < bounds[v].lo - BOUND_TOLERANCE) { held.set(v, bounds[v].lo); grew = true; }
        else if (value > bounds[v].hi + BOUND_TOLERANCE) { held.set(v, bounds[v].hi); grew = true; }
      });
    }
    if (!grew) break;
  }
  // The clearance rows are soft, so the solve can leave a pair a few px too close
  // (and that alone fails the overlap check for every fraction). Push each close
  // pair apart, half the deficit each way, until none is short. Along-axis
  // positions never change, so the pairs and their order stay the same.
  const legal = Float64Array.from(solved!);
  for (let pass = 0; pass < LEGALIZE_PASSES; pass++) {
    let worst = 0;
    for (const pair of pairs) {
      const va = variableOf(pair.a), vb = variableOf(pair.b);
      if (va === vb) continue;
      const deficit = pair.need - pair.sign * (legal[vb] - legal[va]);
      if (deficit <= LEGAL_EPSILON) continue;
      worst = Math.max(worst, deficit);
      legal[va] -= pair.sign * deficit / 2;
      legal[vb] += pair.sign * deficit / 2;
    }
    for (let v = 0; v < n; v++) legal[v] = Math.min(bounds[v].hi, Math.max(bounds[v].lo, legal[v]));
    if (worst <= LEGAL_EPSILON) break;
  }
  // Per box: the centre its chain settled on.
  const solvedCentre = new Map(boxIds.map(id => [id, legal[variableOf(id)]]));
  const original = new Map(boxIds.map(id => [id, boxes.get(id)!]));
  // Group frames are fixed by their children's range, so they are the same before and after.
  const groupFrames: Box[] = result.nodes
    .filter(node => groupIds.has(node.id))
    .map(node => ({ id: node.id, x: node.x, y: node.y, w: node.width, h: node.height }));

  /**
   * A loose node that would slide into a group frame stops at the frame's edge
   * on the side it came from. Only the blocked node is held back; the rest of
   * the solved move still applies.
   */
  function clampOutsideFrames(box: Box, target: number): number {
    if (box.parent) return target;
    const from = horizontal ? box.y : box.x;
    const size = span(box);
    let lo = target;
    for (const frame of groupFrames) {
      const alongLo = horizontal ? box.x : box.y;
      const alongHi = alongLo + (horizontal ? box.w : box.h);
      const frameAlongLo = horizontal ? frame.x : frame.y;
      const frameAlongHi = frameAlongLo + (horizontal ? frame.w : frame.h);
      if (!(alongLo - CLEARANCE < frameAlongHi && alongHi + CLEARANCE > frameAlongLo)) continue;
      const frameLo = horizontal ? frame.y : frame.x;
      const frameHi = frameLo + (horizontal ? frame.h : frame.w);
      const forbidLo = frameLo - CLEARANCE - size - 0.5;
      const forbidHi = frameHi + CLEARANCE + 0.5;
      if (from > forbidLo && from < forbidHi) continue; // already in the zone: leave it
      if (lo > forbidLo && lo < forbidHi) lo = from <= forbidLo ? forbidLo : forbidHi;
    }
    return lo;
  }

  /**
   * Every node stays in its group's range, no node newly overlaps another node
   * or a group frame, and column order holds. "Newly" means: a pair already
   * closer than the clearance in `before` may stay that close, so a tight input
   * layout does not block every move.
   */
  function feasible(next: Map<string, Box>, before: Map<string, Box>): boolean {
    const all = [...next.values()];
    for (const box of all) {
      if (box.parent) {
        const frame = range.get(box.parent)!;
        const lo = horizontal ? box.y : box.x;
        if (lo < frame.lo - 0.5 || lo + span(box) > frame.hi + 0.5) return false;
      }
      if (!box.parent && groupFrames.some(frame => overlaps(box, frame) && !overlaps(before.get(box.id)!, frame))) {
        return false;
      }
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (overlaps(a, b) && !overlaps(before.get(a.id)!, before.get(b.id)!)) return false;
        if (a.parent === b.parent && Math.abs(along(a) - along(b)) < COLUMN_TOLERANCE) {
          const was = Math.sign(cross(before.get(a.id)!) - cross(before.get(b.id)!));
          const now = Math.sign(cross(a) - cross(b));
          if (was !== now) return false;
        }
      }
    }
    return true;
  }

  function overlaps(a: Box, b: Box): boolean {
    return a.x - CLEARANCE < b.x + b.w && a.x + a.w + CLEARANCE > b.x && a.y - CLEARANCE < b.y + b.h && a.y + a.h + CLEARANCE > b.y;
  }

  // Apply the largest safe fraction of the solved move.
  for (const fraction of FRACTIONS) {
    const candidate = new Map<string, Box>();
    for (const id of boxIds) {
      const box = original.get(id)!;
      const from = cross(box);
      const target = from + fraction * (solvedCentre.get(id)! - from);
      const lo = clampOutsideFrames(box, target - span(box) / 2);
      candidate.set(id, horizontal ? { ...box, y: lo } : { ...box, x: lo });
    }
    if (!feasible(candidate, original)) continue;
    const moved = boxIds.filter(id => Math.abs(cross(candidate.get(id)!) - cross(original.get(id)!)) >= 0.5);
    if (moved.length === 0) return { result, fraction: 0 };
    return {
      fraction,
      result: {
        ...result,
        nodes: result.nodes.map(node => {
          const box = candidate.get(node.id);
          return box && moved.includes(node.id) ? { ...node, x: box.x, y: box.y } : node;
        }),
      },
    };
  }
  return { result, fraction: 0 };
}

/** Gaussian elimination with partial pivoting; null when the system is singular. */
function solve(matrix: Float64Array[], rhs: Float64Array): Float64Array | null {
  const n = rhs.length;
  const a = matrix.map(row => Float64Array.from(row));
  const b = Float64Array.from(rhs);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      if (factor === 0) continue;
      for (let k = col; k < n; k++) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}
