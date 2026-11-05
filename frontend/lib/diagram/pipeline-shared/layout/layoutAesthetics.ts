import type { Edge, Node } from 'reactflow';
import type { LayoutParams, LayoutResult } from './LayoutEngine';
import { STUDIO_TITLE_PX } from '@/lib/diagram/nodes/studioMetrics';

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
 * - `fitScale`: the zoom at which the whole diagram fits a typical editor
 *   viewport (never above 1). A long single row makes this small.
 * - `titlePxAtFit`: the on-screen size, in px, of a Studio card title at that
 *   zoom. Below about 9px the diagram is not readable when fitted.
 *
 * Positions are absolute canvas coordinates (parent offsets are resolved here).
 */
export interface LayoutAesthetics {
  fanCenteringError: number;
  /** Sum of every fan's miss, in px: a smooth objective for the layout search. */
  fanErrorTotal: number;
  columnSpacingSpread: number;
  straightEdgeRatio: number;
  /** Edges (between neighbouring columns) whose two ends are level: each one is drawn without a bend. */
  levelEdges: number;
  fans: number;
  columns: number;
  fitScale: number;
  titlePxAtFit: number;
}

/** Typical editor canvas size in px (a 1440×900 window minus toolbars and panels). */
export const FIT_VIEWPORT = { width: 1280, height: 720 } as const;
/** Studio card title size in canvas units (see `studioMetrics`). */
export const STUDIO_TITLE_CANVAS_PX = STUDIO_TITLE_PX;
const FIT_PADDING = 40;
/** Leaves whose centres are this close along the flow share a column (same as `symmetry.ts`). */
const COLUMN_TOLERANCE = 40;

/** Zoom (never above 1) at which a `width` × `height` canvas fits the typical viewport. */
export function fitScaleFor(width: number, height: number): number {
  return Math.min(
    1,
    (FIT_VIEWPORT.width - 2 * FIT_PADDING) / Math.max(1, width),
    (FIT_VIEWPORT.height - 2 * FIT_PADDING) / Math.max(1, height),
  );
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

  // Columns: leaves of one group whose centres share a position along the flow.
  // Same clustering the symmetry pass uses, so both agree on what a column is.
  const columns = new Map<string, string[]>();
  const sortedByAlong = [...leaves].sort((a, b) => along(a.id) - along(b.id));
  let columnIndex = -1;
  let lastAlong = -Infinity;
  const columnOf = new Map<string, number>();
  for (const node of sortedByAlong) {
    if (along(node.id) - lastAlong > COLUMN_TOLERANCE) columnIndex++;
    columnOf.set(node.id, columnIndex);
    lastAlong = along(node.id);
  }

  // A fan's branches are the edges that reach the next column (or stay in this
  // one). An edge that skips columns inside one group is drawn past the nodes in
  // between, so it is not a branch: the symmetry pass ignores it too.
  const skipsColumn = (source: string, target: string) => {
    const forward = along(target) > along(source);
    const sameGroup = parentOf(byId.get(source)!) === parentOf(byId.get(target)!);
    return forward && sameGroup && columnOf.get(target)! - columnOf.get(source)! > 1;
  };
  const out = new Map<string, Set<string>>();
  const into = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.source === edge.target || !leafIds.has(edge.source) || !leafIds.has(edge.target)) continue;
    if (skipsColumn(edge.source, edge.target)) continue;
    (out.get(edge.source) ?? out.set(edge.source, new Set()).get(edge.source)!).add(edge.target);
    (into.get(edge.target) ?? into.set(edge.target, new Set()).get(edge.target)!).add(edge.source);
  }

  // Fans: every branch lies on one side of the node, along the flow. The parent
  // should sit on the mean of its branches (what the symmetry pass solves for).
  let fanCenteringError = 0;
  let fanErrorTotal = 0;
  let fans = 0;
  const checkFan = (id: string, branches: Set<string> | undefined, sign: 1 | -1) => {
    if (!branches || branches.size < 2) return;
    if (![...branches].every(other => (along(other) - along(id)) * sign > 0)) return;
    if (new Set([...branches].map(other => parentOf(byId.get(other)!))).size > 1) return;
    const centers = [...branches].map(cross);
    const mean = centers.reduce((sum, c) => sum + c, 0) / centers.length;
    fans++;
    const miss = Math.abs(cross(id) - mean);
    fanCenteringError = Math.max(fanCenteringError, miss);
    fanErrorTotal += miss;
  };
  for (const node of leaves) {
    checkFan(node.id, out.get(node.id), 1);
    checkFan(node.id, into.get(node.id), -1);
  }

  for (const node of leaves) {
    const key = `${parentOf(node) ?? ''}\u0000${columnOf.get(node.id)}`;
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

  // Level edges: every edge whose two ends share a centre line is drawn straight.
  let levelEdges = 0;
  for (const edge of edges) {
    if (!leafIds.has(edge.source) || !leafIds.has(edge.target) || edge.source === edge.target) continue;
    if (skipsColumn(edge.source, edge.target)) continue;
    if (Math.abs(cross(edge.source) - cross(edge.target)) < 1) levelEdges++;
  }

  // One-to-one links: how many run dead straight.
  let oneToOne = 0;
  let straight = 0;
  for (const edge of edges) {
    if (!leafIds.has(edge.source) || !leafIds.has(edge.target) || edge.source === edge.target) continue;
    if (skipsColumn(edge.source, edge.target)) continue;
    if (out.get(edge.source)?.size !== 1 || into.get(edge.target)?.size !== 1) continue;
    oneToOne++;
    if (Math.abs(cross(edge.source) - cross(edge.target)) < 1) straight++;
  }

  // Fit: the bounding box of every node, scaled to the typical viewport.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x); minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w); maxY = Math.max(maxY, box.y + box.h);
  }
  const fitScale = fitScaleFor(maxX - minX, maxY - minY);

  return {
    fitScale,
    titlePxAtFit: STUDIO_TITLE_CANVAS_PX * fitScale,
    fanCenteringError,
    fanErrorTotal,
    columnSpacingSpread,
    straightEdgeRatio: oneToOne === 0 ? 1 : straight / oneToOne,
    levelEdges,
    fans,
    columns: measuredColumns,
  };
}

/**
 * Scores an engine result with the same measure as a finished canvas. The engine
 * emits absolute positions for every node, children included, while a canvas node
 * stores its position relative to its group, so each child is made relative to its
 * parent here (the measure adds the parent's origin back).
 */
export function measureLayoutResult(result: LayoutResult, params: LayoutParams): LayoutAesthetics {
  const direction = params.direction === 'LR' || params.direction === 'RL' ? 'LR' : 'TD';
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  return measureLayoutAesthetics(
    result.nodes.map(node => {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      return {
        id: node.id,
        type: node.isGroup ? 'groupNode' : 'default',
        position: { x: node.x - (parent?.x ?? 0), y: node.y - (parent?.y ?? 0) },
        parentNode: parent ? node.parentId : undefined,
        width: node.width,
        height: node.height,
        data: {},
      };
    }),
    params.edges.map(edge => ({ id: `${edge.source}->${edge.target}`, source: edge.source, target: edge.target })),
    direction,
  );
}
