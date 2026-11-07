/**
 * Layout problems in a drawn canvas, reported back to the agent so it can fix them in its next
 * call. `draw_on_canvas` places everything exactly where the agent says, so nothing stops a card
 * from overlapping another, sticking out of its group, or sitting so close to its neighbour that
 * the connection label covers a card. Each problem names the nodes and says how to fix it.
 *
 * Works on canvas (absolute) positions, as `describeCanvas` reports them.
 */

export interface LayoutBox {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent?: string;
  text?: string;
}

export interface LayoutEdge {
  source: string;
  target: string;
  label?: unknown;
  data?: unknown;
}

export type LayoutIssueKind = 'overlap' | 'group-overlap' | 'outside-group' | 'over-other-group' | 'label-gap';

export interface LayoutIssue {
  kind: LayoutIssueKind;
  ids: string[];
  message: string;
}

const isGroup = (box: LayoutBox) => box.type === 'groupNode' || box.type === 'group' || box.type === 'frameNode';
/** Shapes are decoration: a panel behind cards or a line across them is meant to overlap. */
const isDecor = (box: LayoutBox) => box.type === 'decorNode';
const name = (box: LayoutBox) => (box.text ? `"${box.text}" (${box.id})` : box.id);

/** Width of the drawn pill for a label: about 6.2px a character at 10.5px plus padding. */
export function labelPillWidth(text: string): number {
  return Math.round(Math.min(text.length, 40) * 6.2 + 16);
}

/** Room a connection needs between two cards beyond its label: the arrowhead and a gap on each side. */
const LABEL_MARGIN = 40;

function overlapArea(a: LayoutBox, b: LayoutBox): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const labelOf = (edge: LayoutEdge): string => {
  const raw = typeof edge.label === 'string' ? edge.label : (edge.data as { label?: unknown } | undefined)?.label;
  return typeof raw === 'string' ? raw.trim() : '';
};

export function checkLayout(boxes: readonly LayoutBox[], edges: readonly LayoutEdge[] = [], limit = 20): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const byId = new Map(boxes.map(box => [box.id, box]));
  const groups = boxes.filter(isGroup);
  const leaves = boxes.filter(box => !isGroup(box) && !isDecor(box));

  // Cards (and text) on top of each other.
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      if (overlapArea(a, b) <= 1) continue;
      issues.push({ kind: 'overlap', ids: [a.id, b.id], message: `${name(a)} and ${name(b)} overlap. Move one of them (keep about 40px between cards).` });
    }
  }

  // Groups on top of each other (groups cannot be nested, so any overlap is a collision).
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (overlapArea(a, b) <= 1) continue;
      issues.push({ kind: 'group-overlap', ids: [a.id, b.id], message: `Groups ${name(a)} and ${name(b)} overlap. Move one group (move its id with the group's children) or shrink it.` });
    }
  }

  for (const leaf of leaves) {
    // A card that sticks out of its own group.
    const parent = leaf.parent ? byId.get(leaf.parent) : undefined;
    if (parent) {
      const out: string[] = [];
      const left = parent.x - leaf.x, top = parent.y - leaf.y;
      const right = leaf.x + leaf.width - (parent.x + parent.width), bottom = leaf.y + leaf.height - (parent.y + parent.height);
      if (left > 1) out.push(`${Math.round(left)}px on the left`);
      if (right > 1) out.push(`${Math.round(right)}px on the right`);
      if (top > 1) out.push(`${Math.round(top)}px at the top`);
      if (bottom > 1) out.push(`${Math.round(bottom)}px at the bottom`);
      if (out.length) {
        issues.push({ kind: 'outside-group', ids: [leaf.id, parent.id], message: `${name(leaf)} sticks out of its group ${name(parent)} by ${out.join(', ')}. Move it inside or widen the group.` });
      }
    }
    // A card drawn over a group it does not belong to.
    for (const group of groups) {
      if (group.id === leaf.parent) continue;
      if (overlapArea(leaf, group) <= 1) continue;
      issues.push({ kind: 'over-other-group', ids: [leaf.id, group.id], message: `${name(leaf)} sits over the group ${name(group)} but is not in it. Move it out, or put it in the group (update parent).` });
    }
  }

  // Connected cards too close for the connection's label to fit between them.
  for (const edge of edges) {
    const text = labelOf(edge);
    if (!text) continue;
    const a = byId.get(edge.source), b = byId.get(edge.target);
    if (!a || !b || isGroup(a) || isGroup(b)) continue;
    const horizontalGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const verticalGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    // Side by side (they overlap vertically) or one above the other (they overlap horizontally).
    const sideBySide = horizontalGap > 0 && verticalGap < 0;
    const stacked = verticalGap > 0 && horizontalGap < 0;
    if (sideBySide) {
      const need = labelPillWidth(text) + LABEL_MARGIN;
      if (horizontalGap < need) {
        issues.push({ kind: 'label-gap', ids: [a.id, b.id], message: `The label "${text}" needs about ${need}px between ${name(a)} and ${name(b)}, but they are ${Math.round(horizontalGap)}px apart, so it will cover a card. Move them apart or shorten the label.` });
      }
    } else if (stacked) {
      const need = 24 + LABEL_MARGIN;
      if (verticalGap < need) {
        issues.push({ kind: 'label-gap', ids: [a.id, b.id], message: `The label "${text}" needs about ${need}px between ${name(a)} and ${name(b)}, but they are ${Math.round(verticalGap)}px apart. Move them apart or shorten the label.` });
      }
    }
  }

  return issues.slice(0, limit);
}
