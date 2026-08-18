/**
 * Returns the x/y coordinate at a fractional position t (0–1) along an SVG path string.
 * Falls back to midpoint on error.
 */
import { withSvgPath } from '@/lib/utils/svgPathMeasure';

export function getPointOnPath(
  pathD: string,
  t: number
): { x: number; y: number; angle: number } {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0, angle: 0 };
  }

  return withSvgPath(
    pathD,
    (path) => {
      const totalLength = path.getTotalLength();
      const clamped = Math.max(0, Math.min(1, t));
      const tLength = totalLength * clamped;
      const point = path.getPointAtLength(tLength);

      const offset = 1;
      const length2 = tLength + offset <= totalLength ? tLength + offset : tLength - offset;
      const point2 = path.getPointAtLength(length2);

      const multiplier = tLength + offset <= totalLength ? 1 : -1;
      const dx = (point2.x - point.x) * multiplier;
      const dy = (point2.y - point.y) * multiplier;

      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      while (angle < -180) angle += 360;
      while (angle > 180) angle -= 360;

      if (angle > 90 || angle < -90) {
        angle += 180;
      }

      return { x: point.x, y: point.y, angle };
    },
    { x: 0, y: 0, angle: 0 },
  );
}

/**
 * Given a pointer position and SVG path, finds the closest t (0-1)
 * along the path by sampling.
 */
export function findClosestT(
  pathD: string,
  px: number,
  py: number,
  samples = 100
): number {
  if (typeof window === 'undefined') return 0.5;

  return withSvgPath(
    pathD,
    (path) => {
      const totalLength = path.getTotalLength();
      let bestT = 0.5;
      let bestDist = Infinity;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = path.getPointAtLength(totalLength * t);
        const dist = (pt.x - px) ** 2 + (pt.y - py) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }

      return Math.max(0.05, Math.min(0.95, bestT));
    },
    0.5,
  );
}

/** Pixels to leave clear before a hand-drawn arrowhead (matches roughRenderer size). */
export const SKETCH_ARROWHEAD_TRIM_PX = 10;

/**
 * Shorten an SVG path from the end so a separate arrowhead can sit at the tip
 * without the stroke running through it. Browser-only; returns `pathD` unchanged
 * when `getTotalLength` is unavailable (SSR / export fallbacks).
 */
export function shortenSvgPathEnd(pathD: string, trimPx: number): string {
  if (trimPx <= 0 || typeof window === 'undefined') return pathD;

  return withSvgPath(
    pathD,
    (path) => {
      const totalLength = path.getTotalLength();
      if (totalLength <= trimPx + 2) return pathD;

      const endLength = totalLength - trimPx;
      const step = Math.max(2, endLength / 80);
      const parts: string[] = [];
      let len = 0;
      let first = true;
      while (len <= endLength) {
        const pt = path.getPointAtLength(len);
        parts.push(`${first ? 'M' : 'L'} ${pt.x} ${pt.y}`);
        first = false;
        len += step;
      }
      const endPt = path.getPointAtLength(endLength);
      parts.push(`L ${endPt.x} ${endPt.y}`);
      return parts.join(' ');
    },
    pathD,
  );
}
