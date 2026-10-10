/**
 * SVG path building utilities for orthogonal/smoothstep edge rendering.
 * Extracted from collisionFreeEdgePath.ts for single-responsibility.
 */

/** Pull the terminal waypoint inward so a separate arrowhead can sit on the tip. */
export function trimWaypointsEnd(
  waypoints: Array<{ x: number; y: number }>,
  trimPx: number,
): Array<{ x: number; y: number }> {
  if (trimPx <= 0 || waypoints.length < 2) return waypoints;
  const result = waypoints.map((p) => ({ ...p }));
  const end = result[result.length - 1];
  const prev = result[result.length - 2];
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len <= trimPx) return result;
  const scale = (len - trimPx) / len;
  result[result.length - 1] = { x: prev.x + dx * scale, y: prev.y + dy * scale };
  return result;
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
