/**
 * A* grid-based fallback path finder for edges that cannot be routed
 * with simple L/Z/U-shape candidates.
 * Extracted from collisionFreeEdgePath.ts for single-responsibility.
 */
import { type NodeRect } from './waypoints';
import { orthogonalizeDiagonalSegments } from './waypoints';

export interface AstFallbackOutcome {
  path: Array<{ x: number; y: number }> | null;
  status: 'ok' | 'no-path-found' | 'search-budget-exceeded';
  expandedStates: number;
}

export function findAstFallbackPathDetailed(
  sx: number, sy: number,
  tx: number, ty: number,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
  maxExpandedStates = 12_000,
): AstFallbackOutcome {
  if (!nodeRects || nodeRects.size === 0) return { path: null, status: 'no-path-found', expandedStates: 0 };

  const GRID_SIZE = 40;
  const PADDING = 200;

  let minX = Math.min(sx, tx) - PADDING;
  let minY = Math.min(sy, ty) - PADDING;
  let maxX = Math.max(sx, tx) + PADDING;
  let maxY = Math.max(sy, ty) + PADDING;

  for (const [, rect] of nodeRects) {
    if (excludedIds.has(rect.id)) continue;
    minX = Math.min(minX, rect.x - PADDING);
    minY = Math.min(minY, rect.y - PADDING);
    maxX = Math.max(maxX, rect.x + rect.w + PADDING);
    maxY = Math.max(maxY, rect.y + rect.h + PADDING);
  }

  const toGrid = (v: number, min: number) => Math.round((v - min) / GRID_SIZE);
  const toWorld = (g: number, min: number) => g * GRID_SIZE + min + GRID_SIZE / 2;

  const cols = Math.ceil((maxX - minX) / GRID_SIZE);
  const rows = Math.ceil((maxY - minY) / GRID_SIZE);

  const grid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (const [, rect] of nodeRects) {
    if (excludedIds.has(rect.id)) continue;
    const nx1 = Math.max(0, toGrid(rect.x, minX));
    const nx2 = Math.min(cols - 1, toGrid(rect.x + rect.w, minX));
    const ny1 = Math.max(0, toGrid(rect.y, minY));
    const ny2 = Math.min(rows - 1, toGrid(rect.y + rect.h, minY));
    for (let y = ny1; y <= ny2; y++) {
      for (let x = nx1; x <= nx2; x++) {
        grid[y][x] = true;
      }
    }
  }

  const sg = { x: toGrid(sx, minX), y: toGrid(sy, minY) };
  const tg = { x: toGrid(tx, minX), y: toGrid(ty, minY) };

  if (sg.x < 0 || sg.x >= cols || sg.y < 0 || sg.y >= rows) return { path: null, status: 'no-path-found', expandedStates: 0 };
  if (tg.x < 0 || tg.x >= cols || tg.y < 0 || tg.y >= rows) return { path: null, status: 'no-path-found', expandedStates: 0 };

  grid[sg.y][sg.x] = false;
  grid[tg.y][tg.x] = false;

  const manhattan = (x: number, y: number) => Math.abs(x - tg.x) + Math.abs(y - tg.y);
  const start = sg.y * cols + sg.x;
  const goal = tg.y * cols + tg.x;
  const gScore = new Map<number, number>([[start, 0]]);
  const open = new Set<number>([start]);
  const cameFrom = new Map<number, number>();

  const dirs = [
    { x: 0, y: 1 }, { x: 1, y: 0 },
    { x: 0, y: -1 }, { x: -1, y: 0 },
  ];

  const heap: Array<{ key: number; priority: number }> = [];
  const heapPush = (k: number, p: number) => {
    heap.push({ key: k, priority: p });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[i].priority >= heap[parent].priority) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const heapPop = (): number | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const bottom = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = bottom;
      let i = 0;
      const len = heap.length;
      while (true) {
        let smallest = i;
        const left = (i << 1) + 1;
        const right = left + 1;
        if (left < len && heap[left].priority < heap[smallest].priority) smallest = left;
        if (right < len && heap[right].priority < heap[smallest].priority) smallest = right;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top.key;
  };

  heapPush(start, manhattan(sg.x, sg.y));

  let found = false;
  let expandedStates = 0;
  let exhausted = false;

  while (heap.length > 0) {
    if (expandedStates >= maxExpandedStates) {
      exhausted = true;
      break;
    }
    const current = heapPop()!;

    if (!open.has(current)) continue;

    if (current === goal) {
      found = true;
      break;
    }

    open.delete(current);
    expandedStates++;

    const cx = current % cols;
    const cy = Math.floor(current / cols);
    const g = gScore.get(current) ?? Infinity;

    const parent = cameFrom.get(current);
    const previousStep = parent === undefined ? undefined : current - parent;

    for (const d of dirs) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (grid[ny][nx]) continue;

      const next = ny * cols + nx;

      let moveCost = 1;
      // Heavy turn penalty — prefer long straight corridors over S-routes
      if (previousStep !== undefined && next - current !== previousStep) moveCost += 8;

      const tentativeG = g + moveCost;
      const existingG = gScore.get(next);

      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(next, current);
        gScore.set(next, tentativeG);
        open.add(next);
        heapPush(next, tentativeG + manhattan(nx, ny));
      }
    }
  }

  if (!found) {
    return {
      path: null,
      status: exhausted ? 'search-budget-exceeded' : 'no-path-found',
      expandedStates,
    };
  }

  const waypoints: Array<{ x: number; y: number }> = [];
  for (let cell: number | undefined = goal; cell !== undefined; cell = cameFrom.get(cell)) {
    waypoints.push({ x: toWorld(cell % cols, minX), y: toWorld(Math.floor(cell / cols), minY) });
  }
  waypoints.reverse();
  waypoints[0] = { x: sx, y: sy };
  waypoints[waypoints.length - 1] = { x: tx, y: ty };

  return {
    path: orthogonalizeDiagonalSegments(waypoints, nodeRects, excludedIds),
    status: 'ok',
    expandedStates,
  };
}

export function findAstFallbackPath(
  sx: number, sy: number,
  tx: number, ty: number,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> | null {
  return findAstFallbackPathDetailed(sx, sy, tx, ty, nodeRects, excludedIds).path;
}
