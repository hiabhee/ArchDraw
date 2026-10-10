/**
 * Post-layout placement for free-text / annotation nodes.
 *
 * Text nodes are excluded from Dagre ranking (see IntegratedLayout) because
 * they have no edges and would otherwise be stranded at rank 0. This pass
 * anchors them against the laid-out graph using the `anchor` metadata the
 * build stage stored on `node.data`:
 *
 * - `top`          → stacked above the overall graph bounding box
 * - `subgraph:<id>` → above that group, parent-relative when parented to it
 * - `node:<id>`    → to the right of that node
 * - `none`         → keep the stored position untouched
 */
import type { RFNode } from './types';
import { isTextNode } from './textNodes';

/** Vertical gap between a heading and the graph / group it labels. */
const TEXT_GAP = 24;
/** Horizontal gap between an annotation and the node it references. */
const NODE_GAP = 24;
/** Small stacking gap between multiple top headings. */
const TOP_STACK_GAP = 8;

export function placeTextNodes(nodes: RFNode[]): RFNode[] {
  const textNodes = nodes.filter(isTextNode);
  if (textNodes.length === 0) return nodes;

  const byId = new Map(nodes.map(n => [n.id, n]));
  const groupIds = new Set(nodes.filter(n => n.type === 'groupNode').map(n => n.id));

  // Absolute position of a node, walking up the parent (group) chain.
  const absPosCache = new Map<string, { x: number; y: number }>();
  const getAbsPosition = (node: RFNode): { x: number; y: number } => {
    const cached = absPosCache.get(node.id);
    if (cached) return cached;
    let x = node.position?.x ?? 0;
    let y = node.position?.y ?? 0;
    let current = node.parentNode;
    const guard = new Set<string>([node.id]);
    while (current && groupIds.has(current) && !guard.has(current)) {
      guard.add(current);
      const parent = byId.get(current);
      if (!parent) break;
      x += parent.position?.x ?? 0;
      y += parent.position?.y ?? 0;
      current = parent.parentNode;
    }
    const pos = { x, y };
    absPosCache.set(node.id, pos);
    return pos;
  };

  // Graph bounding box over all non-text nodes (absolute top-left + size).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (isTextNode(node)) continue;
    const p = getAbsPosition(node);
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }
  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  let topStack = 0;

  // Absolute boxes of everything a text element must not sit on top of.
  const occupied = nodes
    .filter(n => !isTextNode(n))
    .map(n => {
      const p = getAbsPosition(n);
      return { x: p.x, y: p.y, w: n.width ?? 0, h: n.height ?? 0 };
    });
  const COLLISION_MARGIN = 8;
  const collides = (x: number, y: number, w: number, h: number): boolean =>
    occupied.some(b =>
      x < b.x + b.w + COLLISION_MARGIN &&
      x + w + COLLISION_MARGIN > b.x &&
      y < b.y + b.h + COLLISION_MARGIN &&
      y + h + COLLISION_MARGIN > b.y
    );

  const place = (node: RFNode): RFNode => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const anchor = (data.anchor as string) ?? 'none';
    const anchorTarget = data.anchorTarget as string | undefined;
    const height = node.height ?? 0;

    if (anchor === 'top') {
      const y = minY - TEXT_GAP - topStack - height;
      topStack += height + TOP_STACK_GAP;
      return { ...node, position: { x: minX, y } };
    }

    if (anchor === 'subgraph' && anchorTarget) {
      const target = byId.get(anchorTarget);
      if (target) {
        const t = getAbsPosition(target);
        const x = t.x;
        const y = t.y - TEXT_GAP - height;
        if (node.parentNode === anchorTarget) {
          return { ...node, position: { x: x - t.x, y: y - t.y } };
        }
        return { ...node, position: { x, y } };
      }
    }

    if (anchor === 'node' && anchorTarget) {
      const target = byId.get(anchorTarget);
      if (target) {
        const t = getAbsPosition(target);
        const targetWidth = target.width ?? 0;
        const targetHeight = target.height ?? 0;
        const w = node.width ?? 0;
        // Prefer the right of the anchor; fall through to other slots when
        // another node already occupies the spot instead of dropping the
        // pill on top of it.
        const candidates = [
          { x: t.x + targetWidth + NODE_GAP, y: t.y },
          { x: t.x + targetWidth + NODE_GAP, y: t.y + targetHeight + NODE_GAP },
          { x: t.x, y: t.y + targetHeight + NODE_GAP },
          { x: t.x - w - NODE_GAP, y: t.y },
          { x: t.x, y: t.y - height - TEXT_GAP },
        ];
        const chosen = candidates.find(c => !collides(c.x, c.y, w, height)) ?? candidates[0];
        return { ...node, position: { x: chosen.x, y: chosen.y } };
      }
    }

    // anchor 'none' (or unresolvable target): keep the stored position.
    return node;
  };

  const placedById = new Map<string, RFNode>();
  for (const node of textNodes) {
    placedById.set(node.id, place(node));
  }

  return nodes.map(node => {
    if (!isTextNode(node)) return node;
    return placedById.get(node.id) ?? node;
  });
}
