import type { EdgePathInput, PathViolation, Point, Rect } from './geometryTypes';

export type PathCommand =
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'arc'; from: Point; to: Point; radius: number; sweep: 0 | 1; center: Point }
  | { kind: 'cubic'; from: Point; control1: Point; control2: Point; to: Point };

export interface RenderedEdgePath {
  d: string;
  commands: readonly PathCommand[];
  samples: readonly Point[];
  length: number;
  bounds: Rect;
}

export interface PathObstacle { id: string; rect: Rect }

const interactionCache = new WeakMap<RenderedEdgePath, WeakMap<RenderedEdgePath, { crossing: boolean; privateOverlap: number }>>();
const sampleIndexes = new WeakMap<RenderedEdgePath, { turns: readonly Point[]; cells: Map<string, Point[]> }>();
function indexSamples(path: RenderedEdgePath) {
  const cached = sampleIndexes.get(path);
  if (cached) return cached;
  const turns: Point[] = [];
  const cells = new Map<string, Point[]>();
  path.samples.forEach((point, i, points) => {
    if (i === 0 || i === points.length - 1 || Math.abs(
      (point.x - points[i - 1].x) * (points[i + 1].y - point.y)
      - (point.y - points[i - 1].y) * (points[i + 1].x - point.x),
    ) > 1e-9) turns.push(point);
    if (i === 0) return;
    const key = `${Math.floor(point.x / 12)},${Math.floor(point.y / 12)}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(point); cells.set(key, bucket);
  });
  const result = { turns, cells };
  sampleIndexes.set(path, result);
  return result;
}

/** Exact proper crossings of the sampled polyline; cache repeated cost checks. */
export function getRenderedPathInteraction(a: RenderedEdgePath, b: RenderedEdgePath): { crossing: boolean; privateOverlap: number } {
  let byOther = interactionCache.get(a);
  const cached = byOther?.get(b);
  if (cached) return cached;
  if (!byOther) { byOther = new WeakMap(); interactionCache.set(a, byOther); }
  let crossing = false, privateOverlap = 0;
  if (a.bounds.x <= b.bounds.x + b.bounds.width + 4 && a.bounds.x + a.bounds.width + 4 >= b.bounds.x
    && a.bounds.y <= b.bounds.y + b.bounds.height + 4 && a.bounds.y + a.bounds.height + 4 >= b.bounds.y) {
    const ai = indexSamples(a), bi = indexSamples(b);
    const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    outer: for (let i = 1; i < ai.turns.length; i++) for (let j = 1; j < bi.turns.length; j++) {
      const p = ai.turns[i - 1], q = ai.turns[i], r = bi.turns[j - 1], s = bi.turns[j];
      if (Math.max(p.x, q.x) < Math.min(r.x, s.x) || Math.max(r.x, s.x) < Math.min(p.x, q.x)
        || Math.max(p.y, q.y) < Math.min(r.y, s.y) || Math.max(r.y, s.y) < Math.min(p.y, q.y)) continue;
      if (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0) { crossing = true; break outer; }
    }
    if (a.samples.length >= 3 && b.samples.length >= 3) for (let i = 1; i < a.samples.length - 1; i++) {
      const t = i / (a.samples.length - 1);
      if (t < 0.08 || t > 0.92) continue;
      const point = a.samples[i], cx = Math.floor(point.x / 12), cy = Math.floor(point.y / 12);
      let near = false;
      nearby: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of bi.cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if ((point.x - other.x) ** 2 + (point.y - other.y) ** 2 <= 9) { near = true; break nearby; }
        }
      }
      if (near) privateOverlap += distance(point, a.samples[i - 1]);
    }
  }
  const result = { crossing, privateOverlap };
  byOther.set(b, result);
  return result;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const unit = (a: Point, b: Point): Point => {
  const length = distance(a, b);
  return length === 0 ? { x: 0, y: 0 } : { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};

function cleanPoints(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (!result.length || distance(result[result.length - 1], point) > 0.001) result.push(point);
  }
  return result;
}

function orthogonalCommands(points: readonly Point[], requestedRadius: number): PathCommand[] {
  const pts = cleanPoints(points);
  const commands: PathCommand[] = [];
  let cursor = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], corner = pts[i], next = pts[i + 1];
    const incoming = unit(prev, corner), outgoing = unit(corner, next);
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    if (Math.abs(cross) < 1e-6) continue;
    const radius = Math.max(0, Math.min(requestedRadius, distance(prev, corner) / 2, distance(corner, next) / 2));
    if (radius <= 0) continue;
    const start = { x: corner.x - incoming.x * radius, y: corner.y - incoming.y * radius };
    const end = { x: corner.x + outgoing.x * radius, y: corner.y + outgoing.y * radius };
    if (distance(cursor, start) > 0.001) commands.push({ kind: 'line', from: cursor, to: start });
    const center = {
      x: corner.x - incoming.x * radius + outgoing.x * radius,
      y: corner.y - incoming.y * radius + outgoing.y * radius,
    };
    commands.push({ kind: 'arc', from: start, to: end, radius, sweep: cross > 0 ? 1 : 0, center });
    cursor = end;
  }
  const last = pts[pts.length - 1];
  if (pts.length === 2) commands.push({ kind: 'line', from: pts[0], to: last });
  else if (pts.length > 1 && distance(cursor, last) > 0.001) commands.push({ kind: 'line', from: cursor, to: last });
  return commands;
}

function distanceToLine(point: Point, a: Point, b: Point): number {
  const length = distance(a, b);
  if (!length) return distance(point, a);
  return Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / length;
}

function sampleCubic(command: Extract<PathCommand, { kind: 'cubic' }>, tolerance = 0.5): Point[] {
  const points: Point[] = [command.from];
  const split = (p0: Point, p1: Point, p2: Point, p3: Point, depth: number) => {
    const flatness = Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3));
    if (flatness <= tolerance || depth >= 16) {
      points.push(p3);
      return;
    }
    const p01 = lerp(p0, p1, 0.5), p12 = lerp(p1, p2, 0.5), p23 = lerp(p2, p3, 0.5);
    const p012 = lerp(p01, p12, 0.5), p123 = lerp(p12, p23, 0.5), mid = lerp(p012, p123, 0.5);
    split(p0, p01, p012, mid, depth + 1);
    split(mid, p123, p23, p3, depth + 1);
  };
  split(command.from, command.control1, command.control2, command.to, 0);
  return points;
}

function sampleArc(command: Extract<PathCommand, { kind: 'arc' }>): Point[] {
  const startAngle = Math.atan2(command.from.y - command.center.y, command.from.x - command.center.x);
  const endAngle = Math.atan2(command.to.y - command.center.y, command.to.x - command.center.x);
  let delta = endAngle - startAngle;
  if (command.sweep === 1) while (delta < 0) delta += Math.PI * 2;
  else while (delta > 0) delta -= Math.PI * 2;
  const maxAngle = 2 * Math.acos(Math.max(-1, 1 - 1 / Math.max(command.radius, 1)));
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / Math.max(maxAngle, 0.02)));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngle + delta * index / steps;
    return { x: command.center.x + command.radius * Math.cos(angle), y: command.center.y + command.radius * Math.sin(angle) };
  });
}

function sampleCommands(commands: readonly PathCommand[]): Point[] {
  const samples: Point[] = [];
  for (const command of commands) {
    const part = command.kind === 'arc' ? sampleArc(command)
      : command.kind === 'cubic' ? sampleCubic(command)
        : [command.from, command.to];
    samples.push(...(samples.length ? part.slice(1) : part));
  }
  return samples;
}

function commandPath(commands: readonly PathCommand[]): string {
  if (!commands.length) return '';
  const first = commands[0].from;
  let d = `M ${first.x},${first.y}`;
  for (const command of commands) {
    if (command.kind === 'line') d += ` L ${command.to.x},${command.to.y}`;
    else if (command.kind === 'arc') d += ` A ${command.radius},${command.radius} 0 0,${command.sweep} ${command.to.x},${command.to.y}`;
    else d += ` C ${command.control1.x},${command.control1.y} ${command.control2.x},${command.control2.y} ${command.to.x},${command.to.y}`;
  }
  return d;
}

function finalize(commands: readonly PathCommand[]): RenderedEdgePath {
  const samples = sampleCommands(commands);
  const lengths = samples.slice(1).map((point, index) => distance(samples[index], point));
  const length = lengths.reduce((sum, value) => sum + value, 0);
  const xs = samples.map(point => point.x), ys = samples.map(point => point.y);
  return {
    d: commandPath(commands),
    commands,
    samples,
    length,
    bounds: samples.length
      ? { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
      : { x: 0, y: 0, width: 0, height: 0 },
  };
}

export function buildEdgePathGeometry(input: EdgePathInput): RenderedEdgePath {
  if (input.kind === 'orthogonal') return finalize(orthogonalCommands(input.waypoints, Math.max(0, input.cornerRadius)));
  return finalize([{
    kind: 'cubic', from: input.start, control1: input.control1,
    control2: input.control2, to: input.end,
  }]);
}

export function pointAtRenderedPath(path: RenderedEdgePath, distanceFraction: number): Point {
  if (!path.samples.length) return { x: 0, y: 0 };
  if (distanceFraction <= 0 || path.length === 0) return path.samples[0];
  if (distanceFraction >= 1) return path.samples[path.samples.length - 1];
  let remaining = path.length * distanceFraction;
  for (let i = 1; i < path.samples.length; i++) {
    const segmentLength = distance(path.samples[i - 1], path.samples[i]);
    if (remaining <= segmentLength) return lerp(path.samples[i - 1], path.samples[i], segmentLength ? remaining / segmentLength : 0);
    remaining -= segmentLength;
  }
  return path.samples[path.samples.length - 1];
}

function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return false;
      continue;
    }
    const ratio = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, ratio);
    else t1 = Math.min(t1, ratio);
    if (t0 > t1) return false;
  }
  return true;
}

export function validateRenderedPath(
  path: RenderedEdgePath,
  obstacles: readonly PathObstacle[],
  clearance: number,
): PathViolation[] {
  const violations: PathViolation[] = [];
  for (const obstacle of obstacles) {
    const expanded = {
      x: obstacle.rect.x - clearance,
      y: obstacle.rect.y - clearance,
      width: obstacle.rect.width + clearance * 2,
      height: obstacle.rect.height + clearance * 2,
    };
    if (path.samples.some(point => point.x >= expanded.x && point.x <= expanded.x + expanded.width && point.y >= expanded.y && point.y <= expanded.y + expanded.height)
      || path.samples.slice(1).some((point, index) => segmentIntersectsRect(path.samples[index], point, expanded))) {
      violations.push({ code: 'PATH_OBSTACLE_INTERSECTION', obstacleId: obstacle.id });
    }
  }
  return violations;
}
