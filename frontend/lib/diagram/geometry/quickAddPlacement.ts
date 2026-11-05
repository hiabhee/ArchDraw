/**
 * Where a quick-add node (n / d / c / y) lands. The new node goes next to the
 * node the user is working on, on the side the diagram suggests: it continues
 * the direction of the edge that feeds the anchor, keeps stacking in the
 * direction the last quick-add went, skips sides that are already crowded, and
 * never lands on top of an existing node. Pure geometry: no store, no React Flow.
 */

import { nodeSize } from './nodeBox';

/** Same set the edge router treats as containers (`isGroupNode`). */
const GROUP_TYPES = new Set(['groupNode', 'frameNode', 'group', 'demoGroup']);
const isGroupLike = (n: PlacementNode) => (n.type !== undefined && GROUP_TYPES.has(n.type)) || n.data?.isGroup === true;

export type PlacementSide = 'right' | 'bottom' | 'left' | 'top';

export interface PlacementNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  parentNode?: string | null;
  parentId?: string | null;
  width?: number | null;
  height?: number | null;
  data?: { nodeWidth?: number; nodeHeight?: number; isGroup?: boolean } | null;
}

export interface PlacementEdge {
  source: string;
  target: string;
}

/** The node the last quick-add created, and the side of its anchor it was put on. */
export interface PlacementMemory {
  nodeId: string;
  side: PlacementSide;
}

export interface QuickAddInput {
  nodes: PlacementNode[];
  edges: PlacementEdge[];
  size: { width: number; height: number };
  /** Selected node ids, in selection order. */
  selectedIds: string[];
  /** The primary selected node (`selectedNodeId`), preferred as the anchor. */
  primaryId?: string | null;
  memory?: PlacementMemory | null;
  viewportCenter: { x: number; y: number };
}

export interface QuickAddPlacement {
  /** Top-left corner; relative to `parentNode` when set, absolute otherwise. */
  position: { x: number; y: number };
  parentNode?: string;
  /** Side of the anchor the node went to; absent when no anchor was used. */
  side?: PlacementSide;
  anchorId?: string;
}

/** Edge-to-edge spacing between a node and the one it was placed next to. */
export const QUICK_ADD_GAP = 80;
/** Spacing copied from a neighbour is kept within this range. */
export const QUICK_ADD_MIN_GAP = 40;
export const QUICK_ADD_MAX_GAP = 160;
/** Minimum clearance kept between a new node and any existing node. */
const CLEARANCE = 24;
/** Inset kept from a group's edge so a child never sits on its border. */
const GROUP_INSET = 8;
const MAX_HOPS = 12;
/** Nodes whose centre lines up with the anchor's within this tolerance form a line. */
const ALIGN_TOLERANCE = 12;
/** How far behind the anchor a neighbour may sit and still count as the line it stacks on. */
const LINE_REACH = QUICK_ADD_GAP * 2.5;
/** Score for continuing a line of aligned nodes, which outweighs the side preference. */
const LINE_BONUS = 3.5;

const SIDE_ORDER: PlacementSide[] = ['right', 'bottom', 'left', 'top'];

/** Tie-breakers: left-to-right flow first, then top-to-bottom. */
const SIDE_BASE: Record<PlacementSide, number> = { right: 1.2, bottom: 1.0, left: 0.6, top: 0.4 };

const DIRECTION: Record<PlacementSide, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  top: { x: 0, y: -1 },
};

interface Rect {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Rect, b: Rect, pad: number) =>
  a.x < b.x + b.width + pad &&
  b.x < a.x + a.width + pad &&
  a.y < b.y + b.height + pad &&
  b.y < a.y + a.height + pad;

const centerOf = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** How far a rectangle reaches in the direction of `side`; larger means further out. */
function farEdge(r: Rect, side: PlacementSide): number {
  switch (side) {
    case 'right': return r.x + r.width;
    case 'left': return -r.x;
    case 'bottom': return r.y + r.height;
    case 'top': return -r.y;
  }
}

/** The slot a new node of `size` would take just beyond `from`, centred on it. */
function slotBeyond(from: Rect, side: PlacementSide, size: { width: number; height: number }, gap: number): Rect {
  switch (side) {
    case 'right':
      return { x: from.x + from.width + gap, y: from.y + from.height / 2 - size.height / 2, ...size };
    case 'left':
      return { x: from.x - gap - size.width, y: from.y + from.height / 2 - size.height / 2, ...size };
    case 'bottom':
      return { x: from.x + from.width / 2 - size.width / 2, y: from.y + from.height + gap, ...size };
    case 'top':
      return { x: from.x + from.width / 2 - size.width / 2, y: from.y - gap - size.height, ...size };
  }
}

function unit(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

/** Where a node should go when there is no anchor: the viewport centre, nudged right until clear. */
function freeSpotAt(
  centre: { x: number; y: number },
  size: { width: number; height: number },
  boxes: Rect[],
): { x: number; y: number } {
  let pos = { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
  for (let i = 0; i < MAX_HOPS; i++) {
    const rect = { ...pos, ...size };
    if (!boxes.some((b) => overlaps(rect, b, CLEARANCE))) return pos;
    pos = { x: pos.x + size.width + QUICK_ADD_GAP, y: pos.y };
  }
  return pos;
}

/**
 * Pick the position for a quick-added node. Each side is tried by walking out
 * from the anchor; when a node already sits in that direction the walk stacks
 * past it, so a chain grows in a line instead of landing on top of itself.
 */
export function placeQuickAddNode(input: QuickAddInput): QuickAddPlacement {
  const { nodes, edges, size, memory, viewportCenter } = input;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const sizeOf = (n: PlacementNode) => nodeSize(n);
  const parentOf = (n: PlacementNode) => n.parentNode ?? n.parentId ?? undefined;

  // Absolute top-left of a node: child positions are relative to their parent.
  const absOrigin = (n: PlacementNode, depth = 0): { x: number; y: number } => {
    const parentId = parentOf(n);
    const parent = parentId && depth < 16 ? byId.get(parentId) : undefined;
    if (!parent) return { x: n.position.x, y: n.position.y };
    const p = absOrigin(parent, depth + 1);
    return { x: p.x + n.position.x, y: p.y + n.position.y };
  };
  const boxOf = (n: PlacementNode): Rect & { id: string } => {
    const origin = absOrigin(n);
    return { id: n.id, x: origin.x, y: origin.y, ...sizeOf(n) };
  };

  const allBoxes = nodes.map(boxOf);
  // With no anchor the node goes at the viewport centre. A group container
  // there is the place to drop it, not something to avoid.
  const freeBoxes = nodes.filter((n) => !isGroupLike(n)).map(boxOf);

  // Anchor: the primary selection, else the last selected node, else the last quick-added node.
  const selectedValid = input.selectedIds.filter((id) => byId.has(id));
  const anchorId =
    (input.primaryId && selectedValid.includes(input.primaryId) ? input.primaryId : undefined) ??
    selectedValid[selectedValid.length - 1] ??
    (memory && byId.has(memory.nodeId) ? memory.nodeId : undefined);

  if (!anchorId) {
    return { position: freeSpotAt(viewportCenter, size, freeBoxes) };
  }

  const anchorNode = byId.get(anchorId)!;
  const anchor = boxOf(anchorNode);

  // Ancestors are containers around the anchor, not obstacles.
  const ancestors = new Set<string>();
  for (let cur = parentOf(anchorNode), depth = 0; cur && depth < 16; depth++) {
    ancestors.add(cur);
    const next = byId.get(cur);
    cur = next ? parentOf(next) : undefined;
  }
  const obstacles = allBoxes.filter((b) => !ancestors.has(b.id));
  const parentId = parentOf(anchorNode);
  const bounds = parentId && byId.has(parentId) ? boxOf(byId.get(parentId)!) : null;

  const linkedIds = edges
    .filter((e) => e.source === anchorId || e.target === anchorId)
    .map((e) => (e.source === anchorId ? e.target : e.source))
    .filter((id) => byId.has(id) && id !== anchorId);
  const anchorCentre = centerOf(anchor);

  const anchorCentreAxis = (r: Rect, side: PlacementSide) =>
    side === 'left' || side === 'right' ? centerOf(r).y : centerOf(r).x;
  const anchorAxis = (side: PlacementSide) => anchorCentreAxis(anchor, side);
  const isAligned = (r: Rect, side: PlacementSide) =>
    Math.abs(anchorCentreAxis(r, side) - anchorAxis(side)) <= ALIGN_TOLERANCE;

  // Spacing to use on a side: the gap to the nearest node in line with the anchor
  // (on either end), so a stack keeps its rhythm. Falls back to the default.
  const spacingFor = (side: PlacementSide): number => {
    const horizontal = side === 'left' || side === 'right';
    let nearest: number | null = null;
    for (const n of obstacles) {
      if (!isAligned(n, side)) continue;
      const gaps = horizontal
        ? [n.x - (anchor.x + anchor.width), anchor.x - (n.x + n.width)]
        : [n.y - (anchor.y + anchor.height), anchor.y - (n.y + n.height)];
      for (const g of gaps) {
        if (g >= QUICK_ADD_MIN_GAP - CLEARANCE && g <= LINE_REACH && (nearest === null || g < nearest)) {
          nearest = g;
        }
      }
    }
    if (nearest === null) return QUICK_ADD_GAP;
    return Math.min(QUICK_ADD_MAX_GAP, Math.max(QUICK_ADD_MIN_GAP, Math.round(nearest)));
  };

  // Walk out from the anchor on one side. Returns null if that side has no room.
  // `hops` counts nodes stepped past; `misses` those that are not on the anchor's line.
  const walk = (side: PlacementSide): { rect: Rect; misses: number; hops: number } | null => {
    const gap = spacingFor(side);
    let cur: Rect = anchor;
    let misses = 0;
    for (let hops = 0; hops <= MAX_HOPS; hops++) {
      const slot = slotBeyond(cur, side, size, gap);
      if (bounds && !(
        slot.x >= bounds.x + GROUP_INSET &&
        slot.y >= bounds.y + GROUP_INSET &&
        slot.x + slot.width <= bounds.x + bounds.width - GROUP_INSET &&
        slot.y + slot.height <= bounds.y + bounds.height - GROUP_INSET
      )) return null;
      const blockers = obstacles.filter((b) => overlaps(slot, b, CLEARANCE));
      if (blockers.length === 0) return { rect: slot, misses, hops };
      // Stack past the blocker that extends furthest in this direction.
      const next = blockers.reduce((best, b) => (farEdge(b, side) > farEdge(best, side) ? b : best));
      if (farEdge(next, side) <= farEdge(cur, side)) return null;
      if (!isAligned(next, side)) misses++;
      cur = next;
    }
    return null;
  };

  // A neighbour on the line through the anchor, just behind it on `opposite`.
  const lineBehind = (side: PlacementSide) => {
    const opposite: PlacementSide =
      side === 'right' ? 'left' : side === 'left' ? 'right' : side === 'top' ? 'bottom' : 'top';
    return obstacles.some((n) => {
      if (!isAligned(n, side)) return false;
      const gap =
        opposite === 'left' ? anchor.x - (n.x + n.width)
        : opposite === 'right' ? n.x - (anchor.x + anchor.width)
        : opposite === 'top' ? anchor.y - (n.y + n.height)
        : n.y - (anchor.y + anchor.height);
      return gap >= -CLEARANCE && gap <= LINE_REACH;
    });
  };

  let best: { side: PlacementSide; rect: Rect; score: number } | null = null;
  for (const side of SIDE_ORDER) {
    const found = walk(side);
    if (!found) continue;
    const dir = DIRECTION[side];
    let score = SIDE_BASE[side];

    // Stacking: the new node continues a line of nodes through the anchor,
    // either past nodes already in that direction or just beyond the anchor's end.
    if (lineBehind(side) || (found.hops > 0 && found.misses === 0)) score += LINE_BONUS;
    score -= 0.5 * found.misses;

    // Continue the direction of the edge that feeds the anchor.
    for (const e of edges) {
      if (e.target !== anchorId || !byId.has(e.source)) continue;
      const src = centerOf(boxOf(byId.get(e.source)!));
      score += 3 * Math.max(0, dot(unit({ x: anchorCentre.x - src.x, y: anchorCentre.y - src.y }), dir));
    }

    // Linked neighbours already on this side make it crowded.
    let crowd = 0;
    for (const id of linkedIds) {
      const c = centerOf(boxOf(byId.get(id)!));
      if (dot(unit({ x: c.x - anchorCentre.x, y: c.y - anchorCentre.y }), dir) > 0.5) crowd++;
    }
    score -= Math.min(crowd, 3) * 0.5;

    // Stacking: keep going the way the last quick-add went.
    if (memory && memory.nodeId === anchorId && memory.side === side) score += 2.5;

    if (!best || score > best.score) best = { side, rect: found.rect, score };
  }

  if (!best) {
    return { position: freeSpotAt(viewportCenter, size, freeBoxes) };
  }

  const position = bounds
    ? { x: best.rect.x - bounds.x, y: best.rect.y - bounds.y }
    : { x: best.rect.x, y: best.rect.y };
  return {
    position,
    ...(bounds && parentId ? { parentNode: parentId } : {}),
    side: best.side,
    anchorId,
  };
}
