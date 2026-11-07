/**
 * Packs the columns inside groups.
 *
 * A layered layout places each card across the flow to line it up with its neighbours, and in a
 * group whose members sit in one column (a tier of services, a set of stores) that leaves large,
 * uneven gaps: a card lined up with something far away sits well apart from the rest of its
 * column, the group grows tall, and connections loop around the empty space. This pass closes
 * every gap in such a column that is wider than `maxGap` down to `gap`, keeping the cards' order
 * and the column's centre, so the group reads as a neat stack.
 *
 * Positions are absolute canvas coordinates; the group frames are recomputed by the sizing stage.
 * Returns `undefined` when no column needs packing.
 */

export type PackDirection = 'LR' | 'TD';

interface PackNode {
  id: string;
  type?: string;
  parentNode?: string;
  parentId?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  style?: unknown;
  data?: unknown;
}

export interface PackOptions {
  /** Gap left between neighbouring cards in a packed column. */
  gap?: number;
  /** Gaps up to this wide are left alone (they are what the layout chose, not slack). */
  maxGap?: number;
  /**
   * Also open columns with a gap narrower than this to `gap` (connections and their labels run
   * between stacked cards). Off by default: callers keep the result only when it routes better.
   */
  minGap?: number;
  /** Which end of a repacked column stays put: its centre (default), its start or its end. */
  anchor?: 'centre' | 'start' | 'end';
}

const isGroup = (node: PackNode) =>
  node.type === 'groupNode' || node.type === 'group' || node.type === 'frameNode'
  || (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;

const sizeOf = (node: PackNode) => {
  const style = (node.style ?? {}) as { width?: number; height?: number };
  const data = (node.data ?? {}) as { nodeWidth?: number; nodeHeight?: number };
  return {
    w: node.width ?? style.width ?? data.nodeWidth ?? 200,
    h: node.height ?? style.height ?? data.nodeHeight ?? 100,
  };
};

export function packGroupColumns<T extends PackNode>(
  nodes: readonly T[],
  direction: PackDirection,
  options: PackOptions = {},
): T[] | undefined {
  const gap = options.gap ?? 48;
  const maxGap = options.maxGap ?? gap * 2;
  const horizontal = direction === 'LR';
  const parentOf = (node: PackNode) => node.parentNode ?? node.parentId;

  const byGroup = new Map<string, T[]>();
  for (const node of nodes) {
    const parent = parentOf(node);
    if (!parent || isGroup(node)) continue;
    (byGroup.get(parent) ?? byGroup.set(parent, []).get(parent)!).push(node);
  }

  const position = new Map(nodes.map(node => [node.id, { ...node.position }]));
  const along = (node: T) => {
    const { w, h } = sizeOf(node);
    const at = position.get(node.id)!;
    return horizontal ? at.x + w / 2 : at.y + h / 2;
  };
  const crossStart = (node: T) => (horizontal ? position.get(node.id)!.y : position.get(node.id)!.x);
  const crossSize = (node: T) => (horizontal ? sizeOf(node).h : sizeOf(node).w);
  let moved = false;

  for (const members of byGroup.values()) {
    // Columns: members whose centres share a position along the flow.
    const sorted = [...members].sort((a, b) => along(a) - along(b));
    const columns: T[][] = [];
    for (const node of sorted) {
      const last = columns[columns.length - 1];
      const tolerance = (horizontal ? sizeOf(node).w : sizeOf(node).h) / 2;
      if (last && Math.abs(along(last[0]) - along(node)) <= tolerance) last.push(node);
      else columns.push([node]);
    }

    for (const column of columns) {
      if (column.length < 2) continue;
      const stack = [...column].sort((a, b) => crossStart(a) - crossStart(b));
      const gaps = stack.slice(1).map((node, i) => crossStart(node) - (crossStart(stack[i]) + crossSize(stack[i])));
      const minGap = options.minGap ?? -Infinity;
      if (!gaps.some(value => value > maxGap || value < minGap - 0.5)) continue;

      // Pack with even gaps around the column's current centre, in the same order.
      const total = stack.reduce((sum, node) => sum + crossSize(node), 0) + gap * (stack.length - 1);
      const first = crossStart(stack[0]);
      const lastNode = stack[stack.length - 1];
      const end = crossStart(lastNode) + crossSize(lastNode);
      let cursor = options.anchor === 'start' ? first
        : options.anchor === 'end' ? end - total
        : (first + end) / 2 - total / 2;
      for (const node of stack) {
        const at = position.get(node.id)!;
        position.set(node.id, horizontal ? { x: at.x, y: cursor } : { x: cursor, y: at.y });
        cursor += crossSize(node) + gap;
      }
      moved = true;
    }
  }

  if (!moved) return undefined;
  return nodes.map(node => {
    const at = position.get(node.id)!;
    return at.x === node.position.x && at.y === node.position.y ? node : { ...node, position: at };
  });
}

export interface GroupAlignOptions {
  /** Room kept between a moved group and any other group or top-level card. */
  margin?: number;
  /** Move only this group (to try one group at a time). */
  only?: string;
  /** The line to align on (a centre across the flow); by default the median of the groups' centres. */
  target?: number;
}

/**
 * Lines top-level groups up across the flow: in an LR diagram each group is a tier column, and
 * tiers sitting at different heights make connections between them climb and drop. Each group
 * (with everything inside it) is moved so its centre sits on `target`, unless that brings it
 * within `margin` of another group or card. Returns `undefined` when nothing moves.
 */
export function alignGroupCentres<T extends PackNode>(
  nodes: readonly T[],
  direction: PackDirection,
  options: GroupAlignOptions = {},
): T[] | undefined {
  const margin = options.margin ?? 48;
  const horizontal = direction === 'LR';
  const parentOf = (node: PackNode) => node.parentNode ?? node.parentId;
  const byId = new Map(nodes.map(node => [node.id, node]));
  const topOf = (node: PackNode): string => {
    let current = node;
    const seen = new Set<string>();
    while (parentOf(current) && byId.has(parentOf(current)!) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(parentOf(current)!)!;
    }
    return current.id;
  };
  const topGroups = nodes.filter(node => isGroup(node) && !parentOf(node)).map(node => node.id);
  if (topGroups.length < 2) return undefined;

  const members = new Map<string, T[]>();
  for (const node of nodes) {
    if (isGroup(node) && !parentOf(node)) continue;
    const top = topOf(node);
    if (top === node.id) continue;
    (members.get(top) ?? members.set(top, []).get(top)!).push(node);
  }

  const position = new Map(nodes.map(node => [node.id, { ...node.position }]));
  // A unit's box: a group's from its cards (its frame is stale until sizing), a card's own.
  const boxOf = (id: string) => {
    const list = members.get(id)?.filter(node => !isGroup(node)) ?? [];
    const items = list.length ? list : [byId.get(id)!];
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const node of items) {
      const { w, h } = sizeOf(node);
      const at = position.get(node.id)!;
      x1 = Math.min(x1, at.x); y1 = Math.min(y1, at.y);
      x2 = Math.max(x2, at.x + w); y2 = Math.max(y2, at.y + h);
    }
    return { x1, y1, x2, y2 };
  };
  const centre = (id: string) => {
    const b = boxOf(id);
    return horizontal ? (b.y1 + b.y2) / 2 : (b.x1 + b.x2) / 2;
  };
  const units = nodes.filter(node => !parentOf(node)).map(node => node.id);
  const centres = topGroups.map(centre).sort((a, b) => a - b);
  const target = options.target ?? centres[Math.floor(centres.length / 2)];

  let moved = false;
  for (const id of [...topGroups].sort((a, b) => Math.abs(centre(a) - target) - Math.abs(centre(b) - target))) {
    if (options.only && options.only !== id) continue;
    const shift = target - centre(id);
    if (Math.abs(shift) < 0.5) continue;
    const b = boxOf(id);
    const c = horizontal ? { ...b, y1: b.y1 + shift, y2: b.y2 + shift } : { ...b, x1: b.x1 + shift, x2: b.x2 + shift };
    const clear = units.every(other => {
      if (other === id) return true;
      const o = boxOf(other);
      return c.x2 + margin <= o.x1 || o.x2 + margin <= c.x1 || c.y2 + margin <= o.y1 || o.y2 + margin <= c.y1;
    });
    if (!clear) continue;
    for (const node of [byId.get(id)!, ...(members.get(id) ?? [])]) {
      const at = position.get(node.id)!;
      position.set(node.id, horizontal ? { x: at.x, y: at.y + shift } : { x: at.x + shift, y: at.y });
    }
    moved = true;
  }

  if (!moved) return undefined;
  return nodes.map(node => {
    const at = position.get(node.id)!;
    return at.x === node.position.x && at.y === node.position.y ? node : { ...node, position: at };
  });
}
