import type { LayoutParams, LayoutResult } from './LayoutEngine';

/**
 * Symmetry pass, run on the finished layout of every diagram (flat and
 * grouped). Dagre places a node near the median of its neighbours, so a fan-out
 * or fan-in is often lopsided: one short branch, two long ones. This centers a
 * node on the middle of its branches, which is what reads as "designed".
 *
 * A node moves together with the straight one-to-one chain behind it (fan-out)
 * or ahead of it (fan-in), so links that were level stay level.
 *
 * Only moves that are safe are made; a node stays where it is when the move
 * would
 * - leave the group it sits in (group frames are sized from their children
 *   later, so the pass never grows or shifts a frame),
 * - overlap another node, or
 * - change the order of the nodes stacked in its column (that reorders edges
 *   and makes them cross).
 *
 * Fans whose branches sit in different groups are left alone: no single
 * position is centered for both.
 */

const CLEARANCE = 16;
const COLUMN_TOLERANCE = 40;
const FRACTIONS = [1, 0.75, 0.5, 0.25] as const;

interface Box { id: string; x: number; y: number; w: number; h: number; parent?: string }

export function symmetrizeFans(result: LayoutResult, params: LayoutParams): LayoutResult {
  const horizontal = params.direction === 'LR' || params.direction === 'RL';
  // Which way the flow runs along the axis (RL / BT run toward smaller coordinates).
  const flow = params.direction === 'RL' || params.direction === 'BT' ? -1 : 1;
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  const hasGroups = groupIds.size > 0;

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

  const cross = (box: Box) => (horizontal ? box.y + box.h / 2 : box.x + box.w / 2);
  const along = (box: Box) => (horizontal ? box.x + box.w / 2 : box.y + box.h / 2);
  const span = (box: Box) => (horizontal ? box.h : box.w);

  const out = new Map<string, Set<string>>();
  const into = new Map<string, Set<string>>();
  for (const edge of params.edges) {
    if (edge.source === edge.target || !boxes.has(edge.source) || !boxes.has(edge.target)) continue;
    (out.get(edge.source) ?? out.set(edge.source, new Set()).get(edge.source)!).add(edge.target);
    (into.get(edge.target) ?? into.set(edge.target, new Set()).get(edge.target)!).add(edge.source);
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

  const moved = new Set<string>();
  const shifted = (box: Box, delta: number): Box => (horizontal ? { ...box, y: box.y + delta } : { ...box, x: box.x + delta });
  const overlaps = (a: Box, b: Box) =>
    a.x - CLEARANCE < b.x + b.w && a.x + a.w + CLEARANCE > b.x && a.y - CLEARANCE < b.y + b.h && a.y + a.h + CLEARANCE > b.y;

  const fits = (members: Box[], delta: number): boolean => {
    const memberIds = new Set(members.map(member => member.id));
    for (const box of members) {
      const next = shifted(box, delta);
      if (box.parent) {
        const frame = range.get(box.parent)!;
        const lo = horizontal ? next.y : next.x;
        if (lo < frame.lo - 0.5 || lo + span(next) > frame.hi + 0.5) return false;
      } else if (hasGroups) {
        return false; // a loose node beside groups: leave it where the engine put it
      }
      for (const other of boxes.values()) {
        if (memberIds.has(other.id)) continue;
        if (overlaps(next, other)) return false;
        // Same column: keep the order top to bottom.
        if (other.parent === box.parent && Math.abs(along(other) - along(box)) < COLUMN_TOLERANCE
          && Math.sign(cross(other) - cross(box)) !== Math.sign(cross(other) - cross(next))) return false;
      }
    }
    return true;
  };

  /** The nodes that must travel with `id` so straight one-to-one links stay straight. */
  const chainOf = (id: string, backwards: boolean): string[] => {
    const chain: string[] = [id];
    const seen = new Set(chain);
    let current = id;
    for (;;) {
      const next = backwards ? [...(into.get(current) ?? [])] : [...(out.get(current) ?? [])];
      if (next.length !== 1) break;
      const [other] = next;
      const otherBox = boxes.get(other);
      if (!otherBox || seen.has(other) || moved.has(other) || otherBox.parent !== boxes.get(id)!.parent) break;
      const mutual = backwards ? out.get(other) : into.get(other);
      if (mutual?.size !== 1) break;
      if (Math.abs(cross(otherBox) - cross(boxes.get(current)!)) >= 1) break; // only chains that are straight now
      chain.push(other);
      seen.add(other);
      current = other;
    }
    return chain;
  };

  const sweep = (ids: string[], branchesOf: Map<string, Set<string>>, sign: 1 | -1) => {
    for (const id of ids) {
      if (moved.has(id)) continue;
      const box = boxes.get(id)!;
      const branches = [...(branchesOf.get(id) ?? [])].map(other => boxes.get(other)!);
      if (branches.length < 2) continue;
      if (!branches.every(other => (along(other) - along(box)) * sign * flow > 0)) continue;
      if (new Set(branches.map(other => other.parent)).size > 1) continue;
      const centers = branches.map(cross);
      const delta = (Math.min(...centers) + Math.max(...centers)) / 2 - cross(box);
      if (Math.abs(delta) < 0.5) continue;
      // Out-fan: the chain feeding the node moves with it. In-fan: the chain it feeds.
      const members = chainOf(id, sign === 1).map(memberId => boxes.get(memberId)!);
      for (const fraction of FRACTIONS) {
        const step = delta * fraction;
        if (Math.abs(step) < 0.5 || !fits(members, step)) continue;
        for (const member of members) {
          boxes.set(member.id, shifted(member, step));
          moved.add(member.id);
        }
        break;
      }
    }
  };

  const ids = [...boxes.keys()];
  // Fan-outs: children settle first, so work from the sinks back.
  sweep([...ids].sort((a, b) => along(boxes.get(b)!) - along(boxes.get(a)!)), out, 1);
  // Fan-ins: sources settle first, so work from the sources forward.
  sweep([...ids].sort((a, b) => along(boxes.get(a)!) - along(boxes.get(b)!)), into, -1);

  if (moved.size === 0) return result;
  return {
    ...result,
    nodes: result.nodes.map(node => {
      const box = boxes.get(node.id);
      return box && moved.has(node.id) ? { ...node, x: box.x, y: box.y } : node;
    }),
  };
}
