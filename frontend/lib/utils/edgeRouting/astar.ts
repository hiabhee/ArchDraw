/**
 * A* grid-based fallback path finder for edges that cannot be routed
 * with simple L/Z/U-shape candidates.
 * Extracted from collisionFreeEdgePath.ts for single-responsibility.
 */
import { type NodeRect } from './waypoints';
import { orthogonalizeDiagonalSegments } from './waypoints';

export function findAstFallbackPath(
  sx: number, sy: number,
  tx: number, ty: number,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> | null {
  if (!nodeRects || nodeRects.size === 0) return null;

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

  if (sg.x < 0 || sg.x >= cols || sg.y < 0 || sg.y >= rows) return null;
  if (tg.x < 0 || tg.x >= cols || tg.y < 0 || tg.y >= rows) return null;

  grid[sg.y][sg.x] = false;
  grid[tg.y][tg.x] = false;

  const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  type PNode = { x: number; y: number };
  const key = (p: PNode) => `${p.x},${p.y}`;

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();

  const sk = key(sg);
  gScore.set(sk, 0);
  fScore.set(sk, manhattan(sg, tg));
  cameFrom.set(sk, null);

  const dirs = [
    { x: 0, y: 1 }, { x: 1, y: 0 },
    { x: 0, y: -1 }, { x: -1, y: 0 },
  ];

  const heap: Array<{ key: string; priority: number }> = [];
  const heapPush = (k: string, p: number) => {
    heap.push({ key: k, priority: p });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[i].priority >= heap[parent].priority) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const heapPop = (): string | undefined => {
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

  heapPush(sk, fScore.get(sk)!);

  let found = false;

  while (heap.length > 0) {
    const current = heapPop()!;

    if (fScore.get(current) === undefined) continue;

    if (current === key(tg)) {
      found = true;
      break;
    }

    fScore.delete(current);

    const [cx, cy] = current.split(',').map(Number);
    const g = gScore.get(current) ?? Infinity;

    const parentKey = cameFrom.get(current);
    let parentDir: { x: number; y: number } | null = null;
    if (parentKey) {
      const [px, py] = parentKey.split(',').map(Number);
      parentDir = { x: cx - px, y: cy - py };
    }

    for (const d of dirs) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (grid[ny][nx]) continue;

      const nk = `${nx},${ny}`;

      let moveCost = 1;
      // Heavy turn penalty — prefer long straight corridors over S-routes
      if (parentDir && (d.x !== parentDir.x || d.y !== parentDir.y)) moveCost += 8;

      const tentativeG = g + moveCost;
      const existingG = gScore.get(nk);

      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentativeG);
        const f = tentativeG + manhattan({ x: nx, y: ny }, tg);
        fScore.set(nk, f);
        heapPush(nk, f);
      }
    }
  }

  if (!found) return null;

  const pathG: PNode[] = [];
  let ck: string | null = key(tg);
  while (ck) {
    const [cx, cy] = ck.split(',').map(Number);
    pathG.push({ x: cx, y: cy });
    ck = cameFrom.get(ck) ?? null;
  }
  pathG.reverse();

  const waypoints = pathG.map(p => ({ x: toWorld(p.x, minX), y: toWorld(p.y, minY) }));
  waypoints[0] = { x: sx, y: sy };
  waypoints[waypoints.length - 1] = { x: tx, y: ty };

  return orthogonalizeDiagonalSegments(waypoints, nodeRects, excludedIds);
}
