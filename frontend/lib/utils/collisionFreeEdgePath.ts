import { Position } from 'reactflow';

const DEFAULT_BORDER_RADIUS = 24;

export function terminalStubLength(borderRadius: number = DEFAULT_BORDER_RADIUS): number {
  return Math.max(20, borderRadius + 8);
}

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

/**
 * Checks if any segment enters a node's interior using proper segment–rect
 * intersection (Cohen–Sutherland clipping), not the common-outside-bit shortcut
 * which false-positives on diagonal segments.
 */
function pathEntersNodeInterior(
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

export function pathSelfIntersects(points: Array<{ x: number; y: number }>): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      const a = points[i], b = points[i + 1];
      const c = points[j], d = points[j + 1];
      const d1x = b.x - a.x, d1y = b.y - a.y;
      const d2x = d.x - c.x, d2y = d.y - c.y;
      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 1e-10) continue;
      const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / cross;
      const u = ((c.x - a.x) * d1y - (c.y - a.y) * d1x) / cross;
      if (t > 0 && t < 1 && u > 0 && u < 1) return true;
    }
  }
  return false;
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

    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);

    if (dx1 === dx2 && dy1 === dy2) {
      d += ` L ${curr.x},${curr.y}`;
      continue;
    }

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

function countPathBends(points: Array<{ x: number; y: number }>): number {
  if (points.length <= 2) return 0;
  let n = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);
    if (dx1 !== dx2 || dy1 !== dy2) n++;
  }
  return n;
}

function pathManhattanLength(points: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return len;
}

/** Prefer fewer bends, then shorter length — avoids gratuitous S-patterns. */
function pickLowestBendPath(
  candidates: Array<Array<{ x: number; y: number }>>,
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
): Array<{ x: number; y: number }> | null {
  let best: Array<{ x: number; y: number }> | null = null;
  let bestBends = Infinity;
  let bestLen = Infinity;

  for (const raw of candidates) {
    const path = simplifyOrthogonalPath(raw);
    if (path.length < 2) continue;
    if (pathEntersNodeInterior(path, nodeRects, excludedIds)) continue;
    const bends = countPathBends(path);
    const len = pathManhattanLength(path);
    if (bends < bestBends || (bends === bestBends && len < bestLen)) {
      best = path;
      bestBends = bends;
      bestLen = len;
    }
  }

  return best;
}

function collectObstacleMargins(
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
  margin: number = 20,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [, rect] of nodeRects) {
    if (excludedIds.has(rect.id)) continue;
    xs.push(rect.x - margin, rect.x + rect.w + margin);
    ys.push(rect.y - margin, rect.y + rect.h + margin);
  }
  return { xs, ys };
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
  const minX = Math.min(sx, tx) - 200;
  const maxX = Math.max(sx, tx) + 200;
  const { xs, ys } = collectObstacleMargins(nodeRects, excludedIds);

  const candidates: Array<Array<{ x: number; y: number }>> = [];

  // Z-shapes (2 bends) via vertical mid corridor
  const mxCandidates = [...generateCandidates(originalMx, minX, maxX, 40), ...xs];
  const checkedMx = new Set<number>();
  for (const mx of mxCandidates) {
    const rounded = Math.round(mx / 5) * 5;
    if (checkedMx.has(rounded)) continue;
    checkedMx.add(rounded);
    candidates.push([
      { x: sx, y: sy },
      { x: mx, y: sy },
      { x: mx, y: ty },
      { x: tx, y: ty },
    ]);
  }

  // U-wraps above/below (2 bends) — prefer these over A* S-routes when Z fails
  const wrapYs = [
    ...ys,
    Math.min(sy, ty) - 80,
    Math.max(sy, ty) + 80,
    Math.min(sy, ty) - 160,
    Math.max(sy, ty) + 160,
  ];
  const checkedMy = new Set<number>();
  for (const my of wrapYs) {
    const rounded = Math.round(my / 5) * 5;
    if (checkedMy.has(rounded)) continue;
    checkedMy.add(rounded);
    candidates.push([
      { x: sx, y: sy },
      { x: sx, y: my },
      { x: tx, y: my },
      { x: tx, y: ty },
    ]);
  }

  return pickLowestBendPath(candidates, nodeRects, excludedIds);
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
  const minY = Math.min(sy, ty) - 200;
  const maxY = Math.max(sy, ty) + 200;
  const { xs, ys } = collectObstacleMargins(nodeRects, excludedIds);

  const candidates: Array<Array<{ x: number; y: number }>> = [];

  const myCandidates = [...generateCandidates(originalMy, minY, maxY, 40), ...ys];
  const checkedMy = new Set<number>();
  for (const my of myCandidates) {
    const rounded = Math.round(my / 5) * 5;
    if (checkedMy.has(rounded)) continue;
    checkedMy.add(rounded);
    candidates.push([
      { x: sx, y: sy },
      { x: sx, y: my },
      { x: tx, y: my },
      { x: tx, y: ty },
    ]);
  }

  const wrapXs = [
    ...xs,
    Math.min(sx, tx) - 80,
    Math.max(sx, tx) + 80,
    Math.min(sx, tx) - 160,
    Math.max(sx, tx) + 160,
  ];
  const checkedMx = new Set<number>();
  for (const mx of wrapXs) {
    const rounded = Math.round(mx / 5) * 5;
    if (checkedMx.has(rounded)) continue;
    checkedMx.add(rounded);
    candidates.push([
      { x: sx, y: sy },
      { x: mx, y: sy },
      { x: mx, y: ty },
      { x: tx, y: ty },
    ]);
  }

  return pickLowestBendPath(candidates, nodeRects, excludedIds);
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

  // Default L is fine — return it so callers don't fall through to A*.
  if (!pathEntersNodeInterior(defaultWaypoints, nodeRects, excludedIds)) {
    return defaultWaypoints;
  }

  const candidates: Array<Array<{ x: number; y: number }>> = [defaultWaypoints];
  const { xs, ys } = collectObstacleMargins(nodeRects, excludedIds, margin);

  // U-wrap style detours (2 bends) around the blocked L-corner
  for (const my of ys) {
    candidates.push([
      { x: sx, y: sy },
      { x: sx, y: my },
      { x: tx, y: my },
      { x: tx, y: ty },
    ]);
  }
  for (const mx of xs) {
    candidates.push([
      { x: sx, y: sy },
      { x: mx, y: sy },
      { x: mx, y: ty },
      { x: tx, y: ty },
    ]);
  }

  // Also try opposite-corner L (still 1 bend)
  const altL = cornerFirstHorizontal
    ? [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }]
    : [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }];
  candidates.push(altL);

  return pickLowestBendPath(candidates, nodeRects, excludedIds);
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

/**
 * Ensure the path leaves/enters along handle normals without introducing
 * local S-patterns. Joins stubs with at most one orthogonal corner each.
 */
function ensureCleanTerminalStubs(
  points: Array<{ x: number; y: number }>,
  sourcePosition: Position,
  targetPosition: Position,
  stubLength: number = terminalStubLength(),
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  const source = points[0];
  const target = points[points.length - 1];
  const sourceDir = getOutwardDirection(sourcePosition);
  const targetDir = getOutwardDirection(targetPosition);

  const sourceStub = {
    x: source.x + sourceDir.dx * stubLength,
    y: source.y + sourceDir.dy * stubLength,
  };
  const targetStub = {
    x: target.x + targetDir.dx * stubLength,
    y: target.y + targetDir.dy * stubLength,
  };

  // Middle of the path (drop existing near-terminal wiggles)
  let middle = points.slice(1, -1);
  // Drop points that sit on the stub segment or reverse back toward the node
  middle = middle.filter((p, i) => {
    if (i === 0 && Math.abs(p.x - sourceStub.x) < 1 && Math.abs(p.y - sourceStub.y) < 1) {
      return false;
    }
    if (
      i === middle.length - 1 &&
      Math.abs(p.x - targetStub.x) < 1 &&
      Math.abs(p.y - targetStub.y) < 1
    ) {
      return false;
    }
    return true;
  });

  // Strip leading points that reverse against the exit direction (S at start)
  while (middle.length > 0) {
    const p = middle[0];
    const along =
      sourceDir.dx !== 0
        ? (p.x - source.x) * sourceDir.dx
        : (p.y - source.y) * sourceDir.dy;
    if (along >= stubLength * 0.5) break;
    middle.shift();
  }

  // Strip trailing points that reverse against the entry approach (S at end)
  while (middle.length > 0) {
    const p = middle[middle.length - 1];
    const along =
      targetDir.dx !== 0
        ? (p.x - target.x) * targetDir.dx
        : (p.y - target.y) * targetDir.dy;
    // Entry approaches from outside: points should be on the outward side
    if (along >= stubLength * 0.5) break;
    middle.pop();
  }

  const joinOrth = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    preferHorizontalFirst: boolean,
  ): Array<{ x: number; y: number }> => {
    if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) return [];
    if (Math.abs(from.x - to.x) < 0.5 || Math.abs(from.y - to.y) < 0.5) {
      return [to];
    }
    if (preferHorizontalFirst) {
      return [{ x: to.x, y: from.y }, to];
    }
    return [{ x: from.x, y: to.y }, to];
  };

  const sourceIsH = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const targetIsH = targetPosition === Position.Left || targetPosition === Position.Right;

  const result: Array<{ x: number; y: number }> = [source, sourceStub];

  if (middle.length === 0) {
    result.push(...joinOrth(sourceStub, targetStub, sourceIsH));
  } else {
    const firstMid = middle[0];
    // Continue along exit axis when possible to avoid an immediate extra bend
    const exitJoinPreferH = sourceIsH;
    result.push(...joinOrth(sourceStub, firstMid, exitJoinPreferH).slice(0, -1));
    result.push(...middle);
    const lastMid = middle[middle.length - 1];
    const entryJoinPreferH = !targetIsH; // vertical target → horizontal join first often cleaner
    const toStub = joinOrth(lastMid, targetStub, targetIsH ? false : entryJoinPreferH);
    // Avoid duplicating lastMid
    result.push(...toStub.filter((p, i) => {
      if (i === 0 && Math.abs(p.x - lastMid.x) < 0.5 && Math.abs(p.y - lastMid.y) < 0.5) return false;
      return true;
    }));
  }

  result.push(target);
  return simplifyOrthogonalPath(result);
}

/**
 * Collapse local S / Z wiggles near terminals: a short reverse on the same axis
 * followed by a correction (classic stub S-pattern).
 */
function collapseLocalSPatterns(
  points: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (points.length < 4) return points;

  let result = [...points];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < result.length - 3; i++) {
      const a = result[i];
      const b = result[i + 1];
      const c = result[i + 2];
      const d = result[i + 3];

      const abx = Math.sign(b.x - a.x);
      const aby = Math.sign(b.y - a.y);
      const bcx = Math.sign(c.x - b.x);
      const bcy = Math.sign(c.y - b.y);
      const cdx = Math.sign(d.x - c.x);
      const cdy = Math.sign(d.y - c.y);

      // S on horizontal: → then ↓/↑ then ← (or mirror), with short reverse
      const horizS =
        aby === 0 && cdy === 0 && abx !== 0 && cdx !== 0 && abx === -cdx && bcx === 0 && bcy !== 0;
      const vertS =
        abx === 0 && cdx === 0 && aby !== 0 && cdy !== 0 && aby === -cdy && bcy === 0 && bcx !== 0;

      if (!horizS && !vertS) continue;

      const reverseLen = horizS
        ? Math.abs(d.x - c.x)
        : Math.abs(d.y - c.y);
      const legLen = horizS
        ? Math.abs(c.y - b.y)
        : Math.abs(c.x - b.x);

      // Only collapse small terminal-style S wiggles, not intentional U-wraps
      if (reverseLen > 80 || legLen > 100) continue;

      // Replace a→b→c→d with a direct orthognal a→…→d (drop the reverse)
      const replacement = horizS
        ? [a, { x: a.x, y: d.y }, d]
        : [a, { x: d.x, y: a.y }, d];

      // Keep endpoints of the span; rebuild
      result = [
        ...result.slice(0, i),
        ...replacement,
        ...result.slice(i + 4),
      ];
      result = simplifyOrthogonalPath(result);
      changed = true;
      break;
    }
  }

  return result;
}

function enforceTerminalStubs(
  points: Array<{ x: number; y: number }>,
  sourcePosition: Position,
  targetPosition: Position,
  stubLength: number = terminalStubLength(),
): Array<{ x: number; y: number }> {
  const cleaned = ensureCleanTerminalStubs(points, sourcePosition, targetPosition, stubLength);
  return collapseLocalSPatterns(cleaned);
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

function computeWaypoints(params: CollisionFreePathParams): Array<{ x: number; y: number }> {
  const {
    sourceX: sx, sourceY: sy,
    targetX: tx, targetY: ty,
    sourcePosition, targetPosition,
    edgeOffset = 0,
    nodeRects,
    excludedNodeIds = new Set(),
  } = params;

  // Pad node rects so edges maintain more distance from nodes
  const NODE_PADDING = 20;
  let paddedRects: Map<string, NodeRect> | undefined;
  if (nodeRects) {
    paddedRects = new Map();
    for (const [id, rect] of nodeRects) {
      paddedRects.set(id, {
        id: rect.id,
        x: rect.x - NODE_PADDING,
        y: rect.y - NODE_PADDING,
        w: rect.w + NODE_PADDING * 2,
        h: rect.h + NODE_PADDING * 2,
      });
    }
  }

  const sourceDir = getOutwardDirection(sourcePosition);
  const targetDir = getOutwardDirection(targetPosition);

  const dist = Math.abs(sx - tx) + Math.abs(sy - ty);
  const radius = params.borderRadius ?? DEFAULT_BORDER_RADIUS;
  const stubLen = Math.min(terminalStubLength(radius), Math.max(24, dist / 3));

  const ssx = sx + sourceDir.dx * stubLen;
  const ssy = sy + sourceDir.dy * stubLen;
  const ttx = tx + targetDir.dx * stubLen;
  const tty = ty + targetDir.dy * stubLen;

  const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;

  let middleWaypoints: Array<{ x: number; y: number }> | null = null;

  if (sourceIsHorizontal && targetIsHorizontal) {
    middleWaypoints = findSafeHtoHPath(ssx, ssy, ttx, tty, edgeOffset, paddedRects, excludedNodeIds);
    if (!middleWaypoints && paddedRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, paddedRects, excludedNodeIds);
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
    middleWaypoints = findSafeVtoVPath(ssx, ssy, ttx, tty, edgeOffset, paddedRects, excludedNodeIds);
    if (!middleWaypoints && paddedRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, paddedRects, excludedNodeIds);
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
    middleWaypoints = findSafeLShapePath(ssx, ssy, ttx, tty, true, paddedRects, excludedNodeIds);
    if (!middleWaypoints && paddedRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, paddedRects, excludedNodeIds);
    }
    if (!middleWaypoints) {
      middleWaypoints = [
        { x: ssx, y: ssy },
        { x: ttx, y: ssy },
        { x: ttx, y: tty },
      ];
    }
  } else {
    middleWaypoints = findSafeLShapePath(ssx, ssy, ttx, tty, false, paddedRects, excludedNodeIds);
    if (!middleWaypoints && paddedRects) {
      middleWaypoints = findAstFallbackPath(ssx, ssy, ttx, tty, paddedRects, excludedNodeIds);
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

  const simplified = simplifyOrthogonalPath(fullWaypoints);
  const withStubs = enforceTerminalStubs(simplified, sourcePosition, targetPosition, stubLen);

  // Prefer a low-bend rebuild when stub cleanup still left an S-heavy path
  const rebuilt = preferLowBendReroute(
    withStubs,
    sx, sy, tx, ty,
    sourcePosition, targetPosition,
    edgeOffset,
    paddedRects,
    excludedNodeIds,
    stubLen,
  );

  const candidate = rebuilt ?? withStubs;

  if (!pathSelfIntersects(candidate)) {
    return candidate;
  }

  const shift = 60;
  for (const delta of [shift, -shift, shift * 2, -shift * 2]) {
    const shifted = candidate.map((pt, i) => {
      if (i === 0 || i === candidate.length - 1) return pt;
      if (sourceIsHorizontal && targetIsHorizontal) {
        return { x: pt.x + delta, y: pt.y };
      } else if (!sourceIsHorizontal && !targetIsHorizontal) {
        return { x: pt.x, y: pt.y + delta };
      } else {
        return { x: pt.x + delta, y: pt.y + delta };
      }
    });
    const cleaned = simplifyOrthogonalPath(shifted);
    const fixed = enforceTerminalStubs(cleaned, sourcePosition, targetPosition, stubLen);
    if (!pathSelfIntersects(fixed)) {
      return fixed;
    }
  }

  return candidate;
}

/**
 * If the path has many bends, try a fresh low-bend U/Z candidate set and keep
 * it when it is collision-free and simpler.
 */
function preferLowBendReroute(
  current: Array<{ x: number; y: number }>,
  sx: number, sy: number,
  tx: number, ty: number,
  sourcePosition: Position,
  targetPosition: Position,
  edgeOffset: number,
  nodeRects: Map<string, NodeRect> | undefined,
  excludedIds: Set<string>,
  stubLen: number,
): Array<{ x: number; y: number }> | null {
  if (!nodeRects || nodeRects.size === 0) return null;

  const currentBends = countPathBends(current);
  if (currentBends <= 2) return null;

  const sourceDir = getOutwardDirection(sourcePosition);
  const targetDir = getOutwardDirection(targetPosition);
  const ssx = sx + sourceDir.dx * stubLen;
  const ssy = sy + sourceDir.dy * stubLen;
  const ttx = tx + targetDir.dx * stubLen;
  const tty = ty + targetDir.dy * stubLen;

  const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;

  let simple: Array<{ x: number; y: number }> | null = null;
  if (sourceIsHorizontal && targetIsHorizontal) {
    simple = findSafeHtoHPath(ssx, ssy, ttx, tty, edgeOffset, nodeRects, excludedIds);
  } else if (!sourceIsHorizontal && !targetIsHorizontal) {
    simple = findSafeVtoVPath(ssx, ssy, ttx, tty, edgeOffset, nodeRects, excludedIds);
  } else {
    simple = findSafeLShapePath(ssx, ssy, ttx, tty, sourceIsHorizontal, nodeRects, excludedIds);
  }

  if (!simple) return null;

  const full = simplifyOrthogonalPath([
    { x: sx, y: sy },
    ...simple,
    { x: tx, y: ty },
  ]);
  const withStubs = enforceTerminalStubs(full, sourcePosition, targetPosition, stubLen);
  const bends = countPathBends(withStubs);

  if (bends < currentBends && !pathEntersNodeInterior(withStubs, nodeRects, excludedIds)) {
    return withStubs;
  }
  return null;
}

export function getCollisionFreeWaypoints(params: CollisionFreePathParams): Array<{ x: number; y: number }> {
  return computeWaypoints(params);
}

export function getCollisionFreeSmoothStepPath(params: CollisionFreePathParams): string {
  const { borderRadius = DEFAULT_BORDER_RADIUS } = params;
  const waypoints = computeWaypoints(params);
  return buildSmoothStepSvg(waypoints, borderRadius);
}
