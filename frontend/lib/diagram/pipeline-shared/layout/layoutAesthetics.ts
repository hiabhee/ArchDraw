import type { Edge, Node } from 'reactflow';

/**
 * Measures how orderly a laid-out diagram looks, in pixels. Diagrams read as
 * "designed" when fan-outs are symmetric, columns are evenly spaced and links
 * run straight, so each is a number that a test can hold to a threshold:
 *
 * - `fanCenteringError`: a node that fans out to (or in from) several nodes of
 *   one group should sit on the middle of its branches. The largest miss, in px
 *   (fans whose branches sit in different groups can't be centered for both and
 *   are not counted).
 * - `columnSpacingSpread`: nodes stacked in one column of one group should be
 *   evenly spaced. The largest difference between two gaps of a column, in px.
 * - `straightEdgeRatio`: share of one-to-one links whose ends are level.
 *
 * Positions are absolute canvas coordinates (parent offsets are resolved here).
 */
export interface LayoutAesthetics {
  fanCenteringError: number;
  columnSpacingSpread: number;
  straightEdgeRatio: number;
  fans: number;
  columns: number;
}

interface Box { x: number; y: number; w: number; h: number }

const parentOf = (node: Node): string | undefined => (node as { parentNode?: string; parentId?: string }).parentNode ?? (node as { parentId?: string }).parentId;
const isGroup = (node: Node): boolean => node.type === 'groupNode' || node.type === 'group';

function absoluteBoxes(nodes: readonly Node[]): Map<string, Box> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const boxes = new Map<string, Box>();
  const resolve = (node: Node): { x: number; y: number } => {
    const parent = parentOf(node);
    const origin = parent && byId.has(parent) ? resolve(byId.get(parent)!) : { x: 0, y: 0 };
    return { x: node.position.x + origin.x, y: node.position.y + origin.y };
  };
  for (const node of nodes) {
    const at = resolve(node);
    boxes.set(node.id, { x: at.x, y: at.y, w: node.width ?? 0, h: node.height ?? 0 });
  }
  return boxes;
}

export function measureLayoutAesthetics(
  nodes: readonly Node[],
  edges: readonly Edge[],
  direction: 'LR' | 'TD' = 'LR',
): LayoutAesthetics {
  const horizontal = direction === 'LR';
  const leaves = nodes.filter(node => !isGroup(node));
  const leafIds = new Set(leaves.map(node => node.id));
  const boxes = absoluteBoxes(nodes);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const cross = (id: string) => { const b = boxes.get(id)!; return horizontal ? b.y + b.h / 2 : b.x + b.w / 2; };
  const along = (id: string) => { const b = boxes.get(id)!; return horizontal ? b.x + b.w / 2 : b.y + b.h / 2; };

  const out = new Map<string, Set<string>>();
  const into = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.source === edge.target || !leafIds.has(edge.source) || !leafIds.has(edge.target)) continue;
    (out.get(edge.source) ?? out.set(edge.source, new Set()).get(edge.source)!).add(edge.target);
    (into.get(edge.target) ?? into.set(edge.target, new Set()).get(edge.target)!).add(edge.source);
  }

  // Fans: every branch lies on one side of the node, along the flow.
  let fanCenteringError = 0;
  let fans = 0;
  const checkFan = (id: string, branches: Set<string> | undefined, sign: 1 | -1) => {
    if (!branches || branches.size < 2) return;
    if (![...branches].every(other => (along(other) - along(id)) * sign > 0)) return;
    if (new Set([...branches].map(other => parentOf(byId.get(other)!))).size > 1) return;
    const centers = [...branches].map(cross);
    fans++;
    fanCenteringError = Math.max(fanCenteringError, Math.abs(cross(id) - (Math.min(...centers) + Math.max(...centers)) / 2));
  };
  for (const node of leaves) {
    checkFan(node.id, out.get(node.id), 1);
    checkFan(node.id, into.get(node.id), -1);
  }

  // Columns: leaves of one group that share a position along the flow.
  const columns = new Map<string, string[]>();
  for (const node of leaves) {
    const key = `${parentOf(node) ?? ''}\u0000${Math.round(along(node.id))}`;
    (columns.get(key) ?? columns.set(key, []).get(key)!).push(node.id);
  }
  let columnSpacingSpread = 0;
  let measuredColumns = 0;
  for (const ids of columns.values()) {
    if (ids.length < 3) continue;
    const sorted = ids.map(id => boxes.get(id)!).sort((a, b) => (horizontal ? a.y - b.y : a.x - b.x));
    const gaps = sorted.slice(1).map((box, i) => (horizontal ? box.y - (sorted[i].y + sorted[i].h) : box.x - (sorted[i].x + sorted[i].w)));
    measuredColumns++;
    columnSpacingSpread = Math.max(columnSpacingSpread, Math.max(...gaps) - Math.min(...gaps));
  }

  // One-to-one links: how many run dead straight.
  let oneToOne = 0;
  let straight = 0;
  for (const edge of edges) {
    if (!leafIds.has(edge.source) || !leafIds.has(edge.target) || edge.source === edge.target) continue;
    if (out.get(edge.source)?.size !== 1 || into.get(edge.target)?.size !== 1) continue;
    oneToOne++;
    if (Math.abs(cross(edge.source) - cross(edge.target)) < 1) straight++;
  }

  return {
    fanCenteringError,
    columnSpacingSpread,
    straightEdgeRatio: oneToOne === 0 ? 1 : straight / oneToOne,
    fans,
    columns: measuredColumns,
  };
}
