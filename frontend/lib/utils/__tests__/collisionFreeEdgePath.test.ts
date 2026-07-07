import { Position } from 'reactflow';
import { describe, it, expect } from 'vitest';
import {
  getCollisionFreeSmoothStepPath,
  getCollisionFreeWaypoints,
} from '../collisionFreeEdgePath';
import type { NodeRect } from '../collisionFreeEdgePath';

function makeRects(entries: Array<{ id: string; x: number; y: number; w?: number; h?: number }>): Map<string, NodeRect> {
  const map = new Map<string, NodeRect>();
  for (const e of entries) {
    map.set(e.id, { id: e.id, x: e.x, y: e.y, w: e.w ?? 160, h: e.h ?? 80 });
  }
  return map;
}

function parsePathPoints(svgPath: string): Array<{ x: number; y: number }> {
  const tokens = svgPath.split(/[MLQ,\s]+/).filter(Boolean).map(Number);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < tokens.length; i += 2) {
    points.push({ x: tokens[i], y: tokens[i + 1] });
  }
  return points;
}

// Check if a point is inside a rect (with margin)
function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Check if any waypoint segment passes through a rect
function pathIntersectsRect(
  waypoints: Array<{ x: number; y: number }>,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    // Check if either endpoint is inside the rect
    if (pointInRect(p1.x, p1.y, rx, ry, rw, rh)) return true;
    if (pointInRect(p2.x, p2.y, rx, ry, rw, rh)) return true;

    // Check if segment (p1->p2) intersects rect using Cohen-Sutherland
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    const code = (x: number, y: number) => {
      let c = INSIDE;
      if (x < rx) c |= LEFT;
      else if (x > rx + rw) c |= RIGHT;
      if (y < ry) c |= TOP;
      else if (y > ry + rh) c |= BOTTOM;
      return c;
    };

    let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    let c1 = code(x1, y1), c2 = code(x2, y2);

    while (true) {
      if (!(c1 | c2)) return true;
      if (c1 & c2) break;
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
  return false;
}

// =============================================================================
// SCENARIO: H→V→H (source Right → target Left)
// =============================================================================
describe('H→V→H path (source Right, target Left)', () => {
  const commonParams = {
    sourceX: 200, sourceY: 100,
    targetX: 800, targetY: 400,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    borderRadius: 0, // 0 for test simplicity
  };

  it('returns default path when no obstacles', () => {
    const svg = getCollisionFreeSmoothStepPath({ ...commonParams });
    const pts = parsePathPoints(svg);
    expect(pts[0]).toEqual({ x: 200, y: 100 });
    const last = pts[pts.length - 1];
    expect(last).toEqual({ x: 800, y: 400 });
    // Default: 4 waypoints (source → midX → midX → target)
    expect(pts.length).toBe(4);
  });

  it('reroutes around a node blocking the vertical mid segment', () => {
    const nodeRects = makeRects([
      // A node sitting exactly where the vertical mid segment would be
      { id: 'blocker', x: 450, y: 150, w: 160, h: 200 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['source', 'target']),
    });

    // Path should not pass through the blocking node
    expect(pathIntersectsRect(waypoints, 450, 150, 160, 200)).toBe(false);

    // Start and end should still match
    expect(waypoints[0]).toEqual({ x: 200, y: 100 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 800, y: 400 });

    // Midpoint should have shifted from default (500) to avoid the node
    const defaultMidX = (200 + 800) / 2;
    const actualMidX = waypoints[1].x;
    expect(actualMidX).not.toBe(defaultMidX);
    // Should be outside the node's expanded x-range (algorithm uses margin=20)
    expect(actualMidX < 450 - 20 || actualMidX > 610 + 20).toBe(true);
  });

  it('keeps default path when obstacles are excluded (source/target)', () => {
    // Node overlaps the source position
    const nodeRects = makeRects([
      { id: 'source', x: 100, y: 50, w: 200, h: 100 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['source']),
    });

    // Should fall back to default (source excluded)
    const defaultMidX = (200 + 800) / 2;
    expect(waypoints[1].x).toBe(defaultMidX);
  });

  it('handles multiple blocking nodes along the vertical axis', () => {
    const nodeRects = makeRects([
      { id: 'blocker1', x: 460, y: 80, w: 160, h: 100 },
      { id: 'blocker2', x: 460, y: 280, w: 160, h: 100 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['source', 'target']),
    });

    // Should not pass through either blocker
    expect(pathIntersectsRect(waypoints, 460, 80, 160, 100)).toBe(false);
    expect(pathIntersectsRect(waypoints, 460, 280, 160, 100)).toBe(false);
  });

  it('preserves parallel edge offset when no obstacle', () => {
    // Without obstacles, offsets should produce different midpoints
    const wp1 = getCollisionFreeWaypoints({
      ...commonParams, edgeOffset: 30,
    });
    const wp2 = getCollisionFreeWaypoints({
      ...commonParams, edgeOffset: -30,
    });

    expect(wp1[1].x - wp2[1].x).toBe(60);
  });

  it('both parallel edges avoid the same blocking node (may converge)', () => {
    const nodeRects = makeRects([
      { id: 'blocker', x: 450, y: 150, w: 160, h: 200 },
    ]);
    const excluded = new Set(['src', 'tgt']);

    const wp1 = getCollisionFreeWaypoints({
      ...commonParams, edgeOffset: 60,
      nodeRects, excludedNodeIds: excluded,
    });
    const wp2 = getCollisionFreeWaypoints({
      ...commonParams, edgeOffset: -60,
      nodeRects, excludedNodeIds: excluded,
    });

    // Both should avoid the node (even if they converge to same passage)
    expect(pathIntersectsRect(wp1, 450, 150, 160, 200)).toBe(false);
    expect(pathIntersectsRect(wp2, 450, 150, 160, 200)).toBe(false);
  });
});

// =============================================================================
// SCENARIO: V→V→H (source Bottom → target Top)
// =============================================================================
describe('V→H→V path (source Bottom, target Top)', () => {
  const commonParams = {
    sourceX: 300, sourceY: 600,
    targetX: 600, targetY: 100,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    borderRadius: 0,
  };

  it('returns default path when no obstacles', () => {
    const svg = getCollisionFreeSmoothStepPath({ ...commonParams });
    const pts = parsePathPoints(svg);
    expect(pts[0]).toEqual({ x: 300, y: 600 });
    expect(pts[pts.length - 1]).toEqual({ x: 600, y: 100 });
    expect(pts.length).toBe(6);
  });

  it('reroutes around a node blocking only the horizontal mid segment', () => {
    // Source at (300, 600, Bottom), target at (600, 100, Top)
    // Default mid Y = 350. Place a node that only blocks the horizontal
    // segment at y=350 without intersecting source (x=300) or target (x=600).
    const nodeRects = makeRects([
      { id: 'blocker', x: 400, y: 330, w: 100, h: 40 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    // Should avoid the node
    expect(pathIntersectsRect(waypoints, 400, 330, 100, 40)).toBe(false);
    expect(waypoints[0]).toEqual({ x: 300, y: 600 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 600, y: 100 });

    // Mid Y should have shifted from default (350) to above or below the node
    const defaultMy = (600 + 100) / 2;
    const actualMy = waypoints[1].y;
    expect(actualMy).not.toBe(defaultMy);
    expect(actualMy < 330 || actualMy > 370).toBe(true);
  });
});

// =============================================================================
// SCENARIO: L-shaped (source Right → target Top)
// =============================================================================
describe('L-shaped path (source Right, target Top)', () => {
  const commonParams = {
    sourceX: 200, sourceY: 300,
    targetX: 500, targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Top,
    borderRadius: 0,
  };

  it('returns default L-shape when no obstacles', () => {
    const svg = getCollisionFreeSmoothStepPath({ ...commonParams });
    const pts = parsePathPoints(svg);
    // Default: source → (targetX, sourceY) → target
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ x: 200, y: 300 });
    expect(pts[1]).toEqual({ x: 500, y: 300 }); // corner
    expect(pts[2]).toEqual({ x: 500, y: 80 });
    expect(pts[3]).toEqual({ x: 500, y: 100 });
  });

  it('reroutes around a node at the L-corner', () => {
    const nodeRects = makeRects([
      // Node covering the corner (500, 300)
      { id: 'blocker', x: 460, y: 260, w: 160, h: 80 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    // Should avoid the node
    expect(pathIntersectsRect(waypoints, 460, 260, 160, 80)).toBe(false);
    // Should still connect source to target
    expect(waypoints[0]).toEqual({ x: 200, y: 300 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 500, y: 100 });
    // Should have 4 waypoints (detour added)
    expect(waypoints.length).toBe(6);
  });
});

// =============================================================================
// SCENARIO: L-shaped (source Bottom → target Right)
// =============================================================================
describe('L-shaped path (source Bottom, target Right)', () => {
  const commonParams = {
    sourceX: 300, sourceY: 500,
    targetX: 800, targetY: 200,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Right,
    borderRadius: 0,
  };

  it('returns default L-shape when no obstacles', () => {
    const svg = getCollisionFreeSmoothStepPath({ ...commonParams });
    const pts = parsePathPoints(svg);
    // Default: source → (sourceX, targetY) → target
    expect(pts.length).toBe(5);
    expect(pts[0]).toEqual({ x: 300, y: 500 });
    expect(pts[1]).toEqual({ x: 300, y: 520 });
    expect(pts[2]).toEqual({ x: 300, y: 200 }); // corner
    expect(pts[3]).toEqual({ x: 820, y: 200 });
    expect(pts[4]).toEqual({ x: 800, y: 200 });
  });

  it('reroutes around a node at the L-corner', () => {
    const nodeRects = makeRects([
      { id: 'blocker', x: 220, y: 140, w: 160, h: 80 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      ...commonParams,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    expect(pathIntersectsRect(waypoints, 220, 140, 160, 80)).toBe(false);
    expect(waypoints[0]).toEqual({ x: 300, y: 500 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 800, y: 200 });
  });
});

// =============================================================================
// SCENARIO: Fallback behavior
// =============================================================================
describe('Fallback behavior', () => {
  it('falls back to default path when no nodeRects provided', () => {
    const waypoints = getCollisionFreeWaypoints({
      sourceX: 100, sourceY: 100,
      targetX: 500, targetY: 300,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    const defaultMidX = (100 + 500) / 2;
    expect(waypoints[1].x).toBe(defaultMidX);
  });

  it('falls back to default path when no safe midpoint found (fully blocked)', () => {
    // A node that spans the entire width between source and target
    const nodeRects = makeRects([
      { id: 'giant', x: 50, y: 50, w: 700, h: 400 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      sourceX: 100, sourceY: 100,
      targetX: 500, targetY: 300,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    // Should fall back to default (midpoint unchanged)
    const defaultMidX = (100 + 500) / 2;
    expect(waypoints[1].x).toBe(defaultMidX);
    // But the path will still pass through the giant node (dimmed)
  });
});

// =============================================================================
// SCENARIO: A* fallback when no midpoint is safe
// =============================================================================
describe('A* fallback (midpoint scanning fails)', () => {
  it('routes around a wide vertical blocker spanning the full Y range', () => {
    // Source Right at (200, 100), target Left at (800, 400)
    // Blocker at (300, 50, 400, 450) spans x=300-700, y=50-450
    // No single midpoint X can create a collision-free 3-segment path.
    // A* should route above (y < 50) or below (y > 450) to get around.
    const nodeRects = makeRects([
      { id: 'column', x: 300, y: 50, w: 400, h: 450 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      sourceX: 200, sourceY: 100,
      targetX: 800, targetY: 400,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    // Should not pass through the column node
    expect(pathIntersectsRect(waypoints, 300, 50, 400, 450)).toBe(false);
    // Still connects source to target
    expect(waypoints[0]).toEqual({ x: 200, y: 100 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 800, y: 400 });
    // More than 4 waypoints indicates A* detour (vs default 4-point smoothstep)
    expect(waypoints.length).toBeGreaterThan(4);
  });

  it('routes around a tall horizontal blocker spanning the full X range (V→H→V)', () => {
    // Source Bottom at (300, 600), target Top at (600, 100)
    // Blocker at (50, 200, 700, 200) spans x=50-750, y=200-400
    // No single midpoint Y can create a collision-free 3-segment path.
    // A* should route left (x < 50) or right (x > 750) to get around.
    const nodeRects = makeRects([
      { id: 'beam', x: 50, y: 200, w: 700, h: 200 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      sourceX: 300, sourceY: 600,
      targetX: 600, targetY: 100,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    expect(pathIntersectsRect(waypoints, 50, 200, 700, 200)).toBe(false);
    expect(waypoints[0]).toEqual({ x: 300, y: 600 });
    expect(waypoints[waypoints.length - 1]).toEqual({ x: 600, y: 100 });
    expect(waypoints.length).toBeGreaterThan(4);
  });

  it('returns null from A* when start cell is inside a blocking node, falls back to default', () => {
    // Source at (100, 100) and its handle is inside the giant node
    const nodeRects = makeRects([
      { id: 'giant', x: 50, y: 50, w: 700, h: 400 },
    ]);

    const waypoints = getCollisionFreeWaypoints({
      sourceX: 100, sourceY: 100,
      targetX: 500, targetY: 300,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      nodeRects,
      excludedNodeIds: new Set(['src', 'tgt']),
    });

    // Falls back to default midX
    const defaultMidX = (100 + 500) / 2;
    expect(waypoints[1].x).toBe(defaultMidX);
    expect(waypoints.length).toBe(4);
  });
});

// =============================================================================
// SCENARIO: getCollisionFreeSmoothStepPath produces valid SVG
// =============================================================================
describe('SVG path output validation', () => {
  it('produces an SVG path starting with M and ending with coordinate', () => {
    const svg = getCollisionFreeSmoothStepPath({
      sourceX: 100, sourceY: 200,
      targetX: 600, targetY: 400,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    expect(svg.startsWith('M')).toBe(true);
    const lastChar = svg[svg.length - 1];
    expect(lastChar).toMatch(/\d/);
  });

  it('both SVG and waypoints produce same start/end', () => {
    const params = {
      sourceX: 150, sourceY: 250,
      targetX: 750, targetY: 350,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };

    const svg = getCollisionFreeSmoothStepPath(params);
    const waypoints = getCollisionFreeWaypoints(params);

    const pts = parsePathPoints(svg);
    expect(pts[0].x).toBe(waypoints[0].x);
    expect(pts[0].y).toBe(waypoints[0].y);
    expect(pts[pts.length - 1].x).toBe(waypoints[waypoints.length - 1].x);
    expect(pts[pts.length - 1].y).toBe(waypoints[waypoints.length - 1].y);
  });
});
