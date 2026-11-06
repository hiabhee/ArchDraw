import { fitScaleFor } from './layoutAesthetics';

/**
 * Folds a long flow into rows (left to right) or lanes (top down), the way text
 * wraps, so the diagram fills a 16:9 screen instead of a thin strip.
 *
 * A flow of many stages is very wide (or very tall) and thin, and fitting it to a
 * screen shrinks every card to a few pixels. This pass works on whole columns: the
 * top-level units (a group with all its contents, or a loose node) that share a
 * rank are one column and stay together, so a fan keeps its shape. The columns, in
 * flow order, are packed into `k` rows of similar length and every other row runs
 * backwards (a serpentine), so the wrap from the end of one row to the start of the
 * next is short. It tries `k` = 2..MAX_ROWS, scores each with the fit-to-viewport
 * metric, and keeps the best only if it fits clearly better than the original.
 *
 * Inside a row the columns keep the gaps Dagre gave them (they hold the room for
 * edge labels) and their cross-axis offsets, so straight links and centred fans
 * are unchanged. Only the top-level placement moves; nothing is resized, and a
 * unit's descendants move with it.
 *
 * Positions are absolute canvas coordinates (Dagre's output).
 */

/** Smallest gap kept between two columns of a row. */
const MIN_COLUMN_GAP = 48;
/** Room between rows for the edges that wrap round and their labels: a tight choice and a roomier one. */
const ROW_GAPS = [96, 150, 220] as const;
const MAX_ROWS = 6;
/** The fold must fit at least this much better than the unfolded layout. */
const MIN_GAIN = 1.15;
/** Units are one column when they overlap along the flow by at least this share of the smaller. */
const COLUMN_OVERLAP = 0.5;
/** The fewest-wrap partition may have a run this much longer than the balanced one's longest. */
const MAX_UNEVENNESS = 1.3;

export type FoldDirection = 'LR' | 'TD';

export interface FoldOptions {
  /** `LR` (default) folds into rows; `TD` folds into lanes. */
  direction?: FoldDirection;
  /**
   * The diagram's edges. With them, some folds break the flow where the fewest edges
   * cross, so fewer edges have to wrap round the end of a row.
   */
  edges?: ReadonlyArray<{ source: string; target: string }>;
}

/** A folded placement and how large it lets the diagram be drawn (see `fitScaleFor`). */
export interface FoldCandidate<T> {
  nodes: T[];
  rows: number;
  rowGap: number;
  fit: number;
}

export interface FoldableNode {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  parentNode?: string | null;
  parentId?: string;
}

interface Unit {
  root: string;
  along0: number;
  along1: number;
  cross0: number;
  cross1: number;
}

interface Column {
  units: Unit[];
  along0: number;
  along1: number;
  cross0: number;
  cross1: number;
}

interface Packing {
  rows: number;
  rowGap: number;
  /** Edges that run between two different rows (the wraps). */
  wraps: number;
  fit: number;
  offsets: Map<string, { along: number; cross: number }>;
}

const parentOf = (node: FoldableNode): string | undefined => node.parentNode ?? node.parentId ?? undefined;

/** The best fold, or the nodes unchanged when folding does not help. */
export function foldLongFlows<T extends FoldableNode>(nodes: readonly T[], options: FoldOptions = {}): T[] {
  return foldCandidates(nodes, options)[0]?.nodes ?? [...nodes];
}

/**
 * Every fold that fits clearly better than the original, best first: one per row
 * count and row gap. A caller that can judge routing tries them in order, since the
 * best-fitting fold is not always the one that routes cleanly.
 */
export function foldCandidates<T extends FoldableNode>(nodes: readonly T[], options: FoldOptions = {}): Array<FoldCandidate<T>> {
  const horizontal = (options.direction ?? 'LR') === 'LR';
  const alongOf = (point: { x: number; y: number }) => (horizontal ? point.x : point.y);
  const crossOf = (point: { x: number; y: number }) => (horizontal ? point.y : point.x);
  const alongSize = (node: FoldableNode) => (horizontal ? node.width : node.height) ?? 0;
  const crossSize = (node: FoldableNode) => (horizontal ? node.height : node.width) ?? 0;
  /** The viewport fit of a canvas `along` long and `cross` across, whichever way the flow runs. */
  const fit = (along: number, cross: number) => (horizontal ? fitScaleFor(along, cross) : fitScaleFor(cross, along));

  const byId = new Map(nodes.map(node => [node.id, node]));
  const rootOf = (node: T): string => {
    let current: FoldableNode = node;
    const seen = new Set<string>([current.id]);
    for (let parent = parentOf(current); parent && byId.has(parent) && !seen.has(parent); parent = parentOf(current)) {
      seen.add(parent);
      current = byId.get(parent)!;
    }
    return current.id;
  };

  const members = new Map<string, T[]>();
  for (const node of nodes) (members.get(rootOf(node)) ?? members.set(rootOf(node), []).get(rootOf(node))!).push(node);
  const units: Unit[] = [...members].map(([root, list]) => {
    let along0 = Infinity, along1 = -Infinity, cross0 = Infinity, cross1 = -Infinity;
    for (const node of list) {
      along0 = Math.min(along0, alongOf(node.position));
      cross0 = Math.min(cross0, crossOf(node.position));
      along1 = Math.max(along1, alongOf(node.position) + alongSize(node));
      cross1 = Math.max(cross1, crossOf(node.position) + crossSize(node));
    }
    return { root, along0, along1, cross0, cross1 };
  }).sort((a, b) => (a.along0 + a.along1) - (b.along0 + b.along1) || a.root.localeCompare(b.root));

  // Columns: units that share a rank (overlap along the flow) stay together.
  const columns: Column[] = [];
  for (const unit of units) {
    const last = columns[columns.length - 1];
    if (last) {
      const overlap = Math.min(last.along1, unit.along1) - Math.max(last.along0, unit.along0);
      const smaller = Math.min(last.along1 - last.along0, unit.along1 - unit.along0);
      if (overlap >= COLUMN_OVERLAP * smaller) {
        last.units.push(unit);
        last.along0 = Math.min(last.along0, unit.along0);
        last.along1 = Math.max(last.along1, unit.along1);
        last.cross0 = Math.min(last.cross0, unit.cross0);
        last.cross1 = Math.max(last.cross1, unit.cross1);
        continue;
      }
    }
    columns.push({ units: [unit], along0: unit.along0, along1: unit.along1, cross0: unit.cross0, cross1: unit.cross1 });
  }

  // A flow with fewer than three columns has nothing to wrap.
  if (columns.length < 3) return [];

  // The gain is measured against the layout as Dagre drew it, not a re-packed row.
  const originalFit = fit(
    Math.max(...columns.map(column => column.along1)) - Math.min(...columns.map(column => column.along0)),
    Math.max(...columns.map(column => column.cross1)) - Math.min(...columns.map(column => column.cross0)),
  );
  // How many edges span the gap after each column: the cost of breaking the flow there.
  const columnOfRoot = new Map<string, number>();
  columns.forEach((column, index) => column.units.forEach(unit => columnOfRoot.set(unit.root, index)));
  const columnOfNode = (id: string) => {
    const node = byId.get(id);
    return node ? columnOfRoot.get(rootOf(node)) : undefined;
  };
  const spanning = Array<number>(columns.length).fill(0);
  for (const edge of options.edges ?? []) {
    const a = columnOfNode(edge.source), b = columnOfNode(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    for (let gap = Math.min(a, b); gap < Math.max(a, b); gap++) spanning[gap]++;
  }

  const packings: Packing[] = [];
  const seen = new Set<string>();
  for (let rows = 2; rows <= Math.min(MAX_ROWS, columns.length); rows++) {
    const balanced = balancedRuns(columns, rows);
    const runSets = [balanced, ...(options.edges ? [fewestWrapRuns(columns, rows, balanced, spanning)] : [])];
    for (const runs of runSets) {
      // A run count the partition could not reach (fewer runs than asked) repeats a smaller one.
      if (!runs || runs.length !== rows) continue;
      for (const rowGap of ROW_GAPS) {
        const key = `${rowGap}:${runs.map(run => run.join('-')).join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const packing = layoutRuns(columns, runs, rowGap, fit, spanning);
        if (packing.fit >= originalFit * MIN_GAIN) packings.push(packing);
      }
    }
  }
  packings.sort((a, b) => b.fit - a.fit || a.wraps - b.wraps || a.rows - b.rows || a.rowGap - b.rowGap);

  return packings.map(packing => ({
    rows: packing.rows,
    rowGap: packing.rowGap,
    fit: packing.fit,
    nodes: nodes.map(node => {
      const offset = packing.offsets.get(rootOf(node));
      if (!offset) return node;
      const dx = horizontal ? offset.along : offset.cross;
      const dy = horizontal ? offset.cross : offset.along;
      return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
    }),
  }));
}

type Runs = Array<[number, number]>;

/** The gap before column i: the original, never less than the minimum. It holds the edge labels. */
function gapBeforeColumn(columns: readonly Column[], i: number): number {
  return i === 0 ? 0 : Math.max(MIN_COLUMN_GAP, columns[i].along0 - columns[i - 1].along1);
}

/** Length of the run of columns `from` .. `to` (inclusive), gaps included. */
function runLengthOf(columns: readonly Column[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i <= to; i++) total += columns[i].along1 - columns[i].along0 + (i > from ? gapBeforeColumn(columns, i) : 0);
  return total;
}

/** Splits the columns, in flow order, into `rows` runs whose longest is as short as it can be (the classic linear partition). */
function balancedRuns(columns: readonly Column[], rows: number): Runs {
  const n = columns.length;
  const best: number[][] = Array.from({ length: rows + 1 }, () => Array(n).fill(Infinity));
  const cut: number[][] = Array.from({ length: rows + 1 }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) best[1][j] = runLengthOf(columns, 0, j);
  for (let k = 2; k <= rows; k++) {
    for (let j = k - 1; j < n; j++) {
      for (let i = k - 1; i <= j; i++) {
        const value = Math.max(best[k - 1][i - 1], runLengthOf(columns, i, j));
        if (value < best[k][j]) { best[k][j] = value; cut[k][j] = i; }
      }
    }
  }
  const runs: Runs = [];
  for (let k = rows, j = n - 1; k >= 1; k--) {
    const from = k === 1 ? 0 : cut[k][j];
    runs.unshift([from, j]);
    j = from - 1;
  }
  return runs;
}

/**
 * Splits the columns into `rows` runs that break the flow where the fewest edges
 * span the break, with no run more than a fixed share longer than the balanced
 * partition's longest. Every edge that spans a break has to wrap round the end of a
 * row, so fewer of them routes better, at the price of rows of a less even length.
 */
function fewestWrapRuns(columns: readonly Column[], rows: number, balanced: Runs, spanning: readonly number[]): Runs | undefined {
  const n = columns.length;
  const limit = Math.max(...balanced.map(([from, to]) => runLengthOf(columns, from, to))) * MAX_UNEVENNESS;
  const cost: number[][] = Array.from({ length: rows + 1 }, () => Array(n).fill(Infinity));
  const cut: number[][] = Array.from({ length: rows + 1 }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) if (runLengthOf(columns, 0, j) <= limit) cost[1][j] = 0;
  for (let k = 2; k <= rows; k++) {
    for (let j = k - 1; j < n; j++) {
      for (let i = k - 1; i <= j; i++) {
        if (runLengthOf(columns, i, j) > limit || cost[k - 1][i - 1] === Infinity) continue;
        const value = cost[k - 1][i - 1] + spanning[i - 1];
        if (value < cost[k][j]) { cost[k][j] = value; cut[k][j] = i; }
      }
    }
  }
  if (cost[rows][n - 1] === Infinity) return undefined;
  const runs: Runs = [];
  for (let k = rows, j = n - 1; k >= 1; k--) {
    const from = k === 1 ? 0 : cut[k][j];
    runs.unshift([from, j]);
    j = from - 1;
  }
  return runs;
}

/** Lays the runs out one under the other, every other run reversed (a serpentine). */
function layoutRuns(
  columns: readonly Column[],
  runs: Runs,
  rowGap: number,
  fit: (along: number, cross: number) => number,
  spanning: readonly number[],
): Packing {
  const length = (column: Column) => column.along1 - column.along0;
  const origin = { along: Math.min(...columns.map(c => c.along0)), cross: Math.min(...columns.map(c => c.cross0)) };
  const widest = Math.max(...runs.map(([from, to]) => runLengthOf(columns, from, to)));
  const offsets = new Map<string, { along: number; cross: number }>();
  let rowTop = origin.cross;
  let crossTotal = 0;
  runs.forEach(([from, to], index) => {
    const row = columns.slice(from, to + 1);
    // The run's cross extent, with every column keeping its own offset inside it, so
    // links between neighbours stay as level (and fans as centred) as they were.
    const rowMin = Math.min(...row.map(c => c.cross0));
    const rowHeight = Math.max(...row.map(c => c.cross1)) - rowMin;
    // Every other run goes backwards, starting under the end of the run above.
    const reversed = index % 2 === 1;
    const visiting = reversed ? [...row].reverse() : row;
    let cursor = origin.along + (reversed ? widest - runLengthOf(columns, from, to) : 0);
    visiting.forEach((column, position) => {
      for (const unit of column.units) offsets.set(unit.root, { along: cursor - column.along0, cross: rowTop - rowMin });
      const next = visiting[position + 1];
      if (!next) return;
      // The gap between two neighbours is the one the layout gave them, in either direction.
      const forwardIndex = from + (reversed ? row.length - 1 - position : position);
      const gap = reversed ? gapBeforeColumn(columns, forwardIndex) : gapBeforeColumn(columns, forwardIndex + 1);
      cursor += length(column) + gap;
    });
    rowTop += rowHeight + rowGap;
    crossTotal += rowHeight + (index > 0 ? rowGap : 0);
  });

  const wraps = runs.slice(0, -1).reduce((sum, [, to]) => sum + spanning[to], 0);
  return { rows: runs.length, rowGap, wraps, fit: fit(widest, crossTotal), offsets };
}
