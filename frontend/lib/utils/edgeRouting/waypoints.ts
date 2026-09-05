/**
 * Orthogonal edge waypoint computation: stub calculation, L/Z/U routing,
 * collision detection, simplification, and the primary exported entry points.
 * Extracted from collisionFreeEdgePath.ts for single-responsibility.
 */
import { Position } from '@/lib/utils/edgePositions';
import { findAstFallbackPath } from './astar';
import { buildSmoothStepSvg } from './svgPathBuilder';

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

const FOREIGN_CLEARANCE = 30;
const TERMINAL_CLEARANCE = 8;

function collectObstacleMargins(
  nodeRects: Map<string, NodeRect>,
  excludedIds: Set<string>,
  margin: number = FOREIGN_CLEARANCE,
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

  if (!pathEntersNodeInterior(defaultWaypoints, nodeRects, excludedIds)) {
    return defaultWaypoints;
  }

  const candidates: Array<Array<{ x: number; y: number }>> = [defaultWaypoints];
  const { xs, ys } = collectObstacleMargins(nodeRects, excludedIds, margin);

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

  const altL = cornerFirstHorizontal
    ? [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }]
    : [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }];
  candidates.push(altL);

  return pickLowestBendPath(candidates, nodeRects, excludedIds);
}

function simplifyOrthogonalPath(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
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
    default:
      return { dx: 0, dy: 1 };
  }
}

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

  let middle = points.slice(1, -1);
  middle = middle.filter((p, i) => {
    if (i === 0 && Math.abs(p.x - sourceStub.x) < 1 && Math.abs(p.y - sourceStub.y) < 1) {
      return false;
    }
    if (
      i === middle.length - 1 &&
      Math.abs(p.x - targetStub.x) < 1 && Math.abs(p.y - targetStub.y) < 1
    ) {
      return false;
    }
    return true;
  });

  while (middle.length > 0) {
    const p = middle[0];
    const along =
      sourceDir.dx !== 0
        ? (p.x - source.x) * sourceDir.dx
        : (p.y - source.y) * sourceDir.dy;
    if (along >= stubLength * 0.5) break;
    middle.shift();
  }

  while (middle.length > 0) {
    const p = middle[middle.length - 1];
    const along =
      targetDir.dx !== 0
        ? (p.x - target.x) * targetDir.dx
        : (p.y - target.y) * targetDir.dy;
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
    const exitJoinPreferH = sourceIsH;
    result.push(...joinOrth(sourceStub, firstMid, exitJoinPreferH).slice(0, -1));
    result.push(...middle);
    const lastMid = middle[middle.length - 1];
    const entryJoinPreferH = !targetIsH;
    const toStub = joinOrth(lastMid, targetStub, targetIsH ? false : entryJoinPreferH);
    result.push(...toStub.filter((p, i) => {
      if (i === 0 && Math.abs(p.x - lastMid.x) < 0.5 && Math.abs(p.y - lastMid.y) < 0.5) return false;
      return true;
    }));
  }

  result.push(target);
  return simplifyOrthogonalPath(result);
}

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

      if (reverseLen > 80 || legLen > 100) continue;

      const replacement = horizS
        ? [a, { x: a.x, y: d.y }, d]
        : [a, { x: d.x, y: a.y }, d];

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

function collapseTinyJogs(
  points: Array<{ x: number; y: number }>,
  nodeRects?: Map<string, NodeRect>,
  excludedIds: Set<string> = new Set(),
): Array<{ x: number; y: number }> {
  if (points.length < 4) return points;
  const TINY = 20;
  let result = [...points];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < result.length - 2; i++) {
      const a = result[i - 1];
      const b = result[i];
      const c = result[i + 1];
      const d = result[i + 2];
      const abH = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 0.5;
      const abV = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 0.5;
      const bcH = Math.abs(b.y - c.y) < 0.5 && Math.abs(b.x - c.x) > 0.5;
      const bcV = Math.abs(b.x - c.x) < 0.5 && Math.abs(b.y - c.y) > 0.5;
      const cdH = Math.abs(c.y - d.y) < 0.5 && Math.abs(c.x - d.x) > 0.5;
      const cdV = Math.abs(c.x - d.x) < 0.5 && Math.abs(c.y - d.y) > 0.5;
      // Pattern: H - tiny V - H (a small step)
      if (abH && bcV && cdH) {
        const tinyLen = Math.abs(c.y - b.y);
        if (tinyLen > 0 && tinyLen < TINY) {
          // Don't touch stubs at the very ends (first/last segment is the
          // terminal stub already). Only collapse middle jogs.
          if (i === 1 || i + 2 === result.length - 1) continue;
          const dirAB = Math.sign(b.x - a.x);
          const dirCD = Math.sign(d.x - c.x);
          if (dirAB !== 0 && dirCD !== 0 && dirAB === dirCD) {
            // Try L at target: keep A.y, vertical at D.x
            const candA = [a, { x: d.x, y: a.y }, d];
            const candB = [a, { x: a.x, y: d.y }, d];
            const pathA = [...result.slice(0, i - 1), ...candA, ...result.slice(i + 3)];
            const pathB = [...result.slice(0, i - 1), ...candB, ...result.slice(i + 3)];
            const simpleA = simplifyOrthogonalPath(pathA);
            const simpleB = simplifyOrthogonalPath(pathB);
            const freeA = !nodeRects || !pathEntersNodeInterior(simpleA, nodeRects, excludedIds);
            const freeB = !nodeRects || !pathEntersNodeInterior(simpleB, nodeRects, excludedIds);
            let chosen: Array<{ x: number; y: number }> | null = null;
            if (freeA && freeB) {
              // Prefer the side that keeps the longer horizontal
              const lenA = Math.abs(d.x - a.x);
              const lenB = Math.abs(d.y - a.y);
              chosen = lenA >= lenB ? simpleA : simpleB;
            } else if (freeA) chosen = simpleA;
            else if (freeB) chosen = simpleB;
            if (chosen) {
              result = chosen;
              changed = true;
              break;
            }
          }
        }
      }
      // Pattern: V - tiny H - V
      if (abV && bcH && cdV) {
        const tinyLen = Math.abs(c.x - b.x);
        if (tinyLen > 0 && tinyLen < TINY) {
          if (i === 1 || i + 2 === result.length - 1) continue;
          const dirAB = Math.sign(b.y - a.y);
          const dirCD = Math.sign(d.y - c.y);
          if (dirAB !== 0 && dirCD !== 0 && dirAB === dirCD) {
            const candA = [a, { x: a.x, y: d.y }, d];
            const candB = [a, { x: d.x, y: a.y }, d];
            const pathA = [...result.slice(0, i - 1), ...candA, ...result.slice(i + 3)];
            const pathB = [...result.slice(0, i - 1), ...candB, ...result.slice(i + 3)];
            const simpleA = simplifyOrthogonalPath(pathA);
            const simpleB = simplifyOrthogonalPath(pathB);
            const freeA = !nodeRects || !pathEntersNodeInterior(simpleA, nodeRects, excludedIds);
            const freeB = !nodeRects || !pathEntersNodeInterior(simpleB, nodeRects, excludedIds);
            let chosen: Array<{ x: number; y: number }> | null = null;
            if (freeA && freeB) {
              const lenA = Math.abs(d.y - a.y);
              const lenB = Math.abs(d.x - a.x);
              chosen = lenA >= lenB ? simpleA : simpleB;
            } else if (freeA) chosen = simpleA;
            else if (freeB) chosen = simpleB;
            if (chosen) {
              result = chosen;
              changed = true;
              break;
            }
          }
        }
      }
    }
  }
  return result;
}

function enforceTerminalStubs(
  points: Array<{ x: number; y: number }>,
  sourcePosition: Position,
  targetPosition: Position,
  stubLength: number = terminalStubLength(),
  nodeRects?: Map<string, NodeRect>,
  excludedIds?: Set<string>,
): Array<{ x: number; y: number }> {
  const cleaned = ensureCleanTerminalStubs(points, sourcePosition, targetPosition, stubLength);
  const noS = collapseLocalSPatterns(cleaned);
  return collapseTinyJogs(noS, nodeRects, excludedIds);
}

export function orthogonalizeDiagonalSegments(
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
  const withStubs = enforceTerminalStubs(full, sourcePosition, targetPosition, stubLen, nodeRects, excludedIds);
  const bends = countPathBends(withStubs);

  if (bends < currentBends && !pathEntersNodeInterior(withStubs, nodeRects, excludedIds)) {
    return withStubs;
  }
  return null;
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

  let paddedRects: Map<string, NodeRect> | undefined;
  if (nodeRects) {
    paddedRects = new Map();
    for (const [id, rect] of nodeRects) {
      const isTerminal = id.startsWith('__edge_');
      const pad = isTerminal ? TERMINAL_CLEARANCE : FOREIGN_CLEARANCE;
      paddedRects.set(id, {
        id: rect.id,
        x: rect.x - pad,
        y: rect.y - pad,
        w: rect.w + pad * 2,
        h: rect.h + pad * 2,
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
  const withStubs = enforceTerminalStubs(simplified, sourcePosition, targetPosition, stubLen, paddedRects, excludedNodeIds);

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
    const fixed = enforceTerminalStubs(cleaned, sourcePosition, targetPosition, stubLen, paddedRects, excludedNodeIds);
    if (!pathSelfIntersects(fixed)) {
      return fixed;
    }
  }

  return candidate;
}

export function getCollisionFreeWaypoints(params: CollisionFreePathParams): Array<{ x: number; y: number }> {
  return computeWaypoints(params);
}

export function getCollisionFreeSmoothStepPath(params: CollisionFreePathParams): string {
  const { borderRadius = DEFAULT_BORDER_RADIUS } = params;
  const waypoints = computeWaypoints(params);
  return buildSmoothStepSvg(waypoints, borderRadius);
}
