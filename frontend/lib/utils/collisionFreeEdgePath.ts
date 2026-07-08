import { Position } from 'reactflow';

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollisionFreePathParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  borderRadius?: number;
  edgeOffset?: number;
  nodeRects?: Map<string, NodeRect>;
  excludedNodeIds?: Set<string>;
}

export function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
  const code = (x: number, y: number) => {
    let c = INSIDE;
    if (x < rx) c |= LEFT;
    else if (x > rx + rw) c |= RIGHT;
    if (y < ry) c |= TOP;
    else if (y > ry + rh) c |= BOTTOM;
    return c;
  };

  let c1 = code(x1, y1), c2 = code(x2, y2);

  while (true) {
    if (!(c1 | c2)) return true;
    if (c1 & c2) return false;
    const c = c1 || c2;
    let x = 0, y = 0;
    if (c & BOTTOM) { x = x1 + (x2 - x1) * (ry + rh - y1) / (y2 - y1); y = ry + rh; }
    else if (c & TOP) { x = x1 + (x2 - x1) * (ry - y1) / (y2 - y1); y = ry; }
    else if (c & RIGHT) { y = y1 + (y2 - y1) * (rx + rw - x1) / (x2 - x1); x = rx + rw; }
    else if (c & LEFT) { y = y1 + (y2 - y1) * (rx - x1) / (x2 - x1); x = rx; }
    if (c === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
    else { x2 = x; y2 = y; c2 = code(x2, y2); }
  }
}

function pathCollidesWithNodes(
  waypoints: Array<{ x: number; y: number }>,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    for (const [id, rect] of nodeRects) {
      if (excludedIds.has(id)) continue;
      if (segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, rect.x, rect.y, rect.w, rect.h)) {
        return true;
      }
    }
  }
  return false;
}

function getIntersectingNodes(
  x1: number, y1: number,
  x2: number, y2: number,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): NodeRect[] {
  const result: NodeRect[] = [];
  for (const [id, rect] of nodeRects) {
    if (excludedIds.has(id)) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, rect.x, rect.y, rect.w, rect.h)) {
      result.push(rect);
    }
  }
  return result;
}

function generateCandidates(
  original: number,
  min: number,
  max: number,
  step: number = 40,
): number[] {
  const candidates: number[] = [original];
  for (let v = original - step; v >= min; v -= step) {
    candidates.push(v);
  }
  for (let v = original + step; v <= max; v += step) {
    candidates.push(v);
  }
  return candidates;
}

export function buildSmoothStepSvg(
  points: Array<{ x: number; y: number }>,
  borderRadius: number,
): string {
  // Remove consecutive duplicates
  const cleaned: Array<{ x: number; y: number }> = [];
  for (const pt of points) {
    if (cleaned.length === 0) {
      cleaned.push(pt);
    } else {
      const last = cleaned[cleaned.length - 1];
      if (Math.abs(pt.x - last.x) > 0.01 || Math.abs(pt.y - last.y) > 0.01) {
        cleaned.push(pt);
      }
    }
  }

  if (cleaned.length < 2) return '';
  if (cleaned.length === 2) {
    return `M ${cleaned[0].x},${cleaned[0].y} L ${cleaned[1].x},${cleaned[1].y}`;
  }

  let d = `M ${cleaned[0].x},${cleaned[0].y}`;

  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];

    const distPrev = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
    const distNext = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
    const r = Math.max(0, Math.min(borderRadius, distPrev / 2, distNext / 2));

    if (r <= 0) {
      d += ` L ${curr.x},${curr.y}`;
      continue;
    }

    let arcStartX = curr.x;
    let arcStartY = curr.y;
    let arcEndX = curr.x;
    let arcEndY = curr.y;

    if (prev.x === curr.x) {
      arcStartY = curr.y + (prev.y > curr.y ? r : -r);
      arcStartX = curr.x;
    } else {
      arcStartX = curr.x + (prev.x > curr.x ? r : -r);
      arcStartY = curr.y;
    }

    if (next.x === curr.x) {
      arcEndY = curr.y + (next.y > curr.y ? r : -r);
      arcEndX = curr.x;
    } else {
      arcEndX = curr.x + (next.x > curr.x ? r : -r);
      arcEndY = curr.y;
    }

    const v1x = curr.x - arcStartX;
    const v1y = curr.y - arcStartY;
    const v2x = arcEndX - curr.x;
    const v2y = arcEndY - curr.y;
    const sweep = (v1x * v2y - v1y * v2x) > 0 ? 1 : 0;

    d += ` L ${arcStartX},${arcStartY}`;
    d += ` A ${r},${r} 0 0,${sweep} ${arcEndX},${arcEndY}`;
  }

  d += ` L ${cleaned[cleaned.length - 1].x},${cleaned[cleaned.length - 1].y}`;
  return d;
}

function findSafeHtoHPath(
  sx: number, sy: number,
  tx: number, ty: number,
  edgeOffset: number,
  nodeRects: Map<string, NodeRect> | undefined,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> | null {
  if (!nodeRects || nodeRects.size === 0) return null;

  const originalMx = (sx + tx) / 2 + edgeOffset;
  const _minX = Math.min(sx, tx) - 200;
  const _maxX = Math.max(sx, tx) + 200;

  const nodeEdgeCandidates: number[] = [];
  for (const [, rect] of nodeRects) {
    if (excludedIds.has(rect.id)) continue;
    const margin = 20;
    nodeEdgeCandidates.push(rect.x - margin);
    nodeEdgeCandidates.push(rect.x + rect.w + margin);
  }

  const candidates = [
    ...generateCandidates(originalMx, _minX, _maxX, 40),
    ...nodeEdgeCandidates,
  ];

  const checked = new Set<number>();
  for (const mx of candidates) {
    const rounded = Math.round(mx / 5) * 5;
    if (checked.has(rounded)) continue;
    checked.add(rounded);

    const waypoints = [
      { x: sx, y: sy },
      { x: mx, y: sy },
      { x: mx, y: ty },
      { x: tx, y: ty },
    ];

    if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
      return waypoints;
    }
  }

  return null;
}

function findSafeVtoVPath(
  sx: number, sy: number,
  tx: number, ty: number,
  edgeOffset: number,
  nodeRects: Map<string, NodeRect> | undefined,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> | null {
  if (!nodeRects || nodeRects.size === 0) return null;

  const originalMy = (sy + ty) / 2 + edgeOffset;
  const _minY = Math.min(sy, ty) - 200;
  const _maxY = Math.max(sy, ty) + 200;

  const nodeEdgeCandidates: number[] = [];
  for (const [, rect] of nodeRects) {
    if (excludedIds.has(rect.id)) continue;
    const margin = 20;
    nodeEdgeCandidates.push(rect.y - margin);
    nodeEdgeCandidates.push(rect.y + rect.h + margin);
  }

  const candidates = [
    ...generateCandidates(originalMy, _minY, _maxY, 40),
    ...nodeEdgeCandidates,
  ];

  const checked = new Set<number>();
  for (const my of candidates) {
    const rounded = Math.round(my / 5) * 5;
    if (checked.has(rounded)) continue;
    checked.add(rounded);

    const waypoints = [
      { x: sx, y: sy },
      { x: sx, y: my },
      { x: tx, y: my },
      { x: tx, y: ty },
    ];

    if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
      return waypoints;
    }
  }

  return null;
}

function findSafeLShapePath(
  sx: number, sy: number,
  tx: number, ty: number,
  cornerFirstHorizontal: boolean,
  nodeRects: Map<string, NodeRect> | undefined,
  excludedIds: Set<string>,
  margin: number = 40,
): Array<{ x: number; y: number }> | null {
  if (!nodeRects || nodeRects.size === 0) return null;

  const defaultWaypoints = cornerFirstHorizontal
    ? [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }]
    : [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }];

  if (!pathCollidesWithNodes(defaultWaypoints, nodeRects, excludedIds)) {
    return null;
  }

  if (cornerFirstHorizontal) {
    const blocking = getIntersectingNodes(sx, sy, tx, sy, nodeRects, excludedIds);
    if (blocking.length > 0) {
      const blockedYs = blocking.map(r => ({ top: r.y, bot: r.y + r.h }));
      const allTopYs = blockedYs.map(b => b.top - margin);
      const allBotYs = blockedYs.map(b => b.bot + margin);

      for (const detourY of [...allTopYs, ...allBotYs]) {
        const waypoints = [
          { x: sx, y: sy },
          { x: sx, y: detourY },
          { x: tx, y: detourY },
          { x: tx, y: ty },
        ];
        if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
          return waypoints;
        }
      }
    }

    const verticalBlocking = getIntersectingNodes(tx, sy, tx, ty, nodeRects, excludedIds);
    if (verticalBlocking.length > 0) {
      const blockedXs = verticalBlocking.map(r => ({ left: r.x, right: r.x + r.w }));
      const allLeftXs = blockedXs.map(b => b.left - margin);
      const allRightXs = blockedXs.map(b => b.right + margin);

      for (const detourX of [...allLeftXs, ...allRightXs]) {
        const waypoints = [
          { x: sx, y: sy },
          { x: detourX, y: sy },
          { x: detourX, y: ty },
          { x: tx, y: ty },
        ];
        if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
          return waypoints;
        }
      }
    }
  } else {
    const blocking = getIntersectingNodes(sx, sy, sx, ty, nodeRects, excludedIds);
    if (blocking.length > 0) {
      const blockedXs = blocking.map(r => ({ left: r.x, right: r.x + r.w }));
      const allLeftXs = blockedXs.map(b => b.left - margin);
      const allRightXs = blockedXs.map(b => b.right + margin);

      for (const detourX of [...allLeftXs, ...allRightXs]) {
        const waypoints = [
          { x: sx, y: sy },
          { x: detourX, y: sy },
          { x: detourX, y: ty },
          { x: tx, y: ty },
        ];
        if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
          return waypoints;
        }
      }
    }

    const horizontalBlocking = getIntersectingNodes(sx, ty, tx, ty, nodeRects, excludedIds);
    if (horizontalBlocking.length > 0) {
      const blockedYs = horizontalBlocking.map(r => ({ top: r.y, bot: r.y + r.h }));
      const allTopYs = blockedYs.map(b => b.top - margin);
      const allBotYs = blockedYs.map(b => b.bot + margin);

      for (const detourY of [...allTopYs, ...allBotYs]) {
        const waypoints = [
          { x: sx, y: sy },
          { x: sx, y: detourY },
          { x: tx, y: detourY },
          { x: tx, y: ty },
        ];
        if (!pathCollidesWithNodes(waypoints, nodeRects, excludedIds)) {
          return waypoints;
        }
      }
    }
  }

  return null;
}

function simplifyOrthogonalPath(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  // Remove consecutive duplicates
  const cleaned: Array<{ x: number; y: number }> = [];
  for (const pt of points) {
    if (cleaned.length === 0) {
      cleaned.push(pt);
    } else {
      const last = cleaned[cleaned.length - 1];
      if (Math.abs(pt.x - last.x) > 0.01 || Math.abs(pt.y - last.y) > 0.01) {
        cleaned.push(pt);
      }
    }
  }

  if (cleaned.length <= 2) return cleaned;

  const result = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];
    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);
    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }
  result.push(cleaned[cleaned.length - 1]);
  return result;
}

function getOutwardDirection(position: Position): { dx: number; dy: number } {
  switch (position) {
    case Position.Left:
      return { dx: -1, dy: 0 };
    case Position.Right:
      return { dx: 1, dy: 0 };
    case Position.Top:
      return { dx: 0, dy: -1 };
    case Position.Bottom:
      return { dx: 0, dy: 1 };
  }
}

function segmentMatchesDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  direction: { dx: number; dy: number },
): boolean {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return dx === direction.dx && dy === direction.dy;
}

function enforceTerminalStubs(
  points: Array<{ x: number; y: number }>,
  sourcePosition: Position,
  targetPosition: Position,
  stubLength: number = 32,
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  const result = [...points];
  const source = result[0];
  const sourceDir = getOutwardDirection(sourcePosition);
  const first = result[1];
  if (!segmentMatchesDirection(source, first, sourceDir)) {
    const sourceStub = {
      x: source.x + sourceDir.dx * stubLength,
      y: source.y + sourceDir.dy * stubLength,
    };
    const insert = [sourceStub];
    if (sourceStub.x !== first.x && sourceStub.y !== first.y) {
      insert.push({ x: first.x, y: sourceStub.y });
    }
    result.splice(1, 0, ...insert);
  }

  const target = result[result.length - 1];
  const targetDir = getOutwardDirection(targetPosition);
  const entryDir = { dx: -targetDir.dx, dy: -targetDir.dy };
  const beforeTarget = result[result.length - 2];
  if (!segmentMatchesDirection(beforeTarget, target, entryDir)) {
    const targetStub = {
      x: target.x + targetDir.dx * stubLength,
      y: target.y + targetDir.dy * stubLength,
    };
    const insert = [];
    if (beforeTarget.x !== targetStub.x && beforeTarget.y !== targetStub.y) {
      insert.push({ x: targetStub.x, y: beforeTarget.y });
    }
    insert.push(targetStub);
    result.splice(result.length - 1, 0, ...insert);
  }

  return simplifyOrthogonalPath(result);
}

function orthogonalizeDiagonalSegments(
  points: Array<{ x: number; y: number }>,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> {
  if (points.length <= 1) return points;

  const result: Array<{ x: number; y: number }> = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const next = points[i];

    if (prev.x !== next.x && prev.y !== next.y) {
      const cornerA = { x: next.x, y: prev.y };
      const cornerB = { x: prev.x, y: next.y };
      const pathA = [prev, cornerA, next];
      const pathB = [prev, cornerB, next];

      if (!pathCollidesWithNodes(pathA, nodeRects, excludedIds)) {
        result.push(cornerA);
      } else if (!pathCollidesWithNodes(pathB, nodeRects, excludedIds)) {
        result.push(cornerB);
      } else {
        result.push(cornerA);
      }
    }

    result.push(next);
  }

  return simplifyOrthogonalPath(result);
}

function findAstFallbackPath(
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
  const openSet = new Set<string>();

  const sk = key(sg);
  gScore.set(sk, 0);
  fScore.set(sk, manhattan(sg, tg));
  cameFrom.set(sk, null);
  openSet.add(sk);

  const dirs = [
    { x: 0, y: 1 }, { x: 1, y: 0 },
    { x: 0, y: -1 }, { x: -1, y: 0 },
  ];

  let found = false;

  while (openSet.size > 0) {
    let current = '';
    let bestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = k;
      }
    }

    if (current === key(tg)) {
      found = true;
      break;
    }

    openSet.delete(current);

    const [cx, cy] = current.split(',').map(Number);
    const g = gScore.get(current) ?? Infinity;

    const parentKey = cameFrom.get(current);
    let parentDir = { x: 0, y: 0 };
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
      if (d.x !== parentDir.x || d.y !== parentDir.y) moveCost += 2;

      const tentativeG = g + moveCost;
      const existingG = gScore.get(nk);

      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentativeG);
        fScore.set(nk, tentativeG + manhattan({ x: nx, y: ny }, tg));
        openSet.add(nk);
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
  // Pin first and last waypoints to exact handle positions
  waypoints[0] = { x: sx, y: sy };
  waypoints[waypoints.length - 1] = { x: tx, y: ty };

  return orthogonalizeDiagonalSegments(waypoints, nodeRects, excludedIds);
}

function computeWaypoints(params: CollisionFreePathParams): Array<{ x: number; y: number }> {
  const {
    sourceX: sx, sourceY: sy,
    targetX: tx, targetY: ty,
    sourcePosition, targetPosition,
    edgeOffset = 0,
    nodeRects,
    excludedNodeIds = new Set(),
  } = params;

  const sourceDir = getOutwardDirection(sourcePosition);
  const targetDir = getOutwardDirection(targetPosition);

  const dist = Math.abs(sx - tx) + Math.abs(sy - ty);
  const stubLen = Math.min(20, Math.max(8, dist / 4));

  const ssx = sx + sourceDir.dx * stubLen;
  const ssy = sy + sourceDir.dy * stubLen;
  const ttx = tx + targetDir.dx * stubLen;
  const tty = ty + targetDir.dy * stubLen;

  const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;

  let middleWaypoints: Array<{ x: number; y: number }> | null = null;

  if (sourceIsHorizontal && targetIsHorizontal) {
    middleWaypoints = findSafeHtoHPath(ssx, ssy, ttx, tty, edgeOffset, nodeRects, excludedNodeIds);
    if (!middleWaypoints && nodeRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, nodeRects, excludedNodeIds);
    }
    if (!middleWaypoints) {
      const mx = (ssx + ttx) / 2 + edgeOffset;
      middleWaypoints = [
        { x: ssx, y: ssy },
        { x: mx, y: ssy },
        { x: mx, y: tty },
        { x: ttx, y: tty },
      ];
    }
  } else if (!sourceIsHorizontal && !targetIsHorizontal) {
    middleWaypoints = findSafeVtoVPath(ssx, ssy, ttx, tty, edgeOffset, nodeRects, excludedNodeIds);
    if (!middleWaypoints && nodeRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, nodeRects, excludedNodeIds);
    }
    if (!middleWaypoints) {
      const my = (ssy + tty) / 2 + edgeOffset;
      middleWaypoints = [
        { x: ssx, y: ssy },
        { x: ssx, y: my },
        { x: ttx, y: my },
        { x: ttx, y: tty },
      ];
    }
  } else if (sourceIsHorizontal) {
    middleWaypoints = findSafeLShapePath(ssx, ssy, ttx, tty, true, nodeRects, excludedNodeIds);
    if (!middleWaypoints && nodeRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, nodeRects, excludedNodeIds);
    }
    if (!middleWaypoints) {
      middleWaypoints = [
        { x: ssx, y: ssy },
        { x: ttx, y: ssy },
        { x: ttx, y: tty },
      ];
    }
  } else {
    middleWaypoints = findSafeLShapePath(ssx, ssy, ttx, tty, false, nodeRects, excludedNodeIds);
    if (!middleWaypoints && nodeRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, nodeRects, excludedNodeIds);
    }
    if (!middleWaypoints) {
      middleWaypoints = [
        { x: ssx, y: ssy },
        { x: ssx, y: tty },
        { x: ttx, y: tty },
      ];
    }
  }

  const fullWaypoints = [
    { x: sx, y: sy },
    ...middleWaypoints,
    { x: tx, y: ty }
  ];

  return simplifyOrthogonalPath(fullWaypoints);
}

export function getCollisionFreeWaypoints(params: CollisionFreePathParams): Array<{ x: number; y: number }> {
  return computeWaypoints(params);
}

export function getCollisionFreeSmoothStepPath(params: CollisionFreePathParams): string {
  const { borderRadius = 12 } = params;
  const waypoints = computeWaypoints(params);
  return buildSmoothStepSvg(waypoints, borderRadius);
}
