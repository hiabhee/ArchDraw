/**
 * Direction an SVG path arrives in at its last point, in radians (`atan2`
 * convention, so it can be handed straight to an arrowhead).
 *
 * Reads the path data itself instead of measuring a rendered element, so it works
 * on the server (where preview and export SVGs are built) as well as in the
 * browser. Sampling a fixed share of the path length before the end is not a
 * substitute: on a long edge whose last run is short, that point lies on the
 * previous segment and the arrowhead comes out turned and apart from the line.
 *
 * Understands M, L, H, V, Q, C, A (circular arcs, which is what rounded corners
 * are) and Z in absolute and relative form, which is everything the edge router
 * and the rough renderer produce. Returns null for anything else so the caller
 * can fall back.
 */
export function pathEndTangentAngle(d: string): number | null {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g);
  if (!tokens) return null;

  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Last non-degenerate direction of travel.
  let dirX = 0;
  let dirY = 0;
  let moved = false;

  const isNumber = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  const read = (): number => Number(tokens[index++]);
  const travel = (fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.hypot(dx, dy) > 1e-6) {
      dirX = dx;
      dirY = dy;
      moved = true;
    }
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) return null;

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;

    if (upper === 'Z') {
      travel(x, y, startX, startY);
      x = startX;
      y = startY;
      continue;
    }
    if (!isNumber()) return null;

    if (upper === 'M') {
      x = ox + read();
      y = oy + read();
      startX = x;
      startY = y;
      command = relative ? 'l' : 'L'; // further pairs are line-tos
    } else if (upper === 'L') {
      const nx = ox + read();
      const ny = oy + read();
      travel(x, y, nx, ny);
      x = nx;
      y = ny;
    } else if (upper === 'H') {
      const nx = ox + read();
      travel(x, y, nx, y);
      x = nx;
    } else if (upper === 'V') {
      const ny = oy + read();
      travel(x, y, x, ny);
      y = ny;
    } else if (upper === 'Q') {
      const cx = ox + read();
      const cy = oy + read();
      const nx = ox + read();
      const ny = oy + read();
      // The curve leaves toward the control point and arrives from it.
      if (Math.hypot(nx - cx, ny - cy) > 1e-6) travel(cx, cy, nx, ny);
      else travel(x, y, nx, ny);
      x = nx;
      y = ny;
    } else if (upper === 'C') {
      read(); read(); // first control point
      const c2x = ox + read();
      const c2y = oy + read();
      const nx = ox + read();
      const ny = oy + read();
      if (Math.hypot(nx - c2x, ny - c2y) > 1e-6) travel(c2x, c2y, nx, ny);
      else travel(x, y, nx, ny);
      x = nx;
      y = ny;
    } else if (upper === 'A') {
      const rx = read();
      const ry = read();
      const rotation = read();
      const large = read();
      const sweep = read();
      const nx = ox + read();
      const ny = oy + read();
      // Only circular, unrotated arcs (rounded corners) are understood.
      if (Math.abs(rx - ry) > 1e-6 || Math.abs(rotation) > 1e-6) return null;
      const tangent = circularArcEndTangent(x, y, nx, ny, Math.abs(rx), large !== 0, sweep !== 0);
      if (tangent) {
        dirX = tangent.x;
        dirY = tangent.y;
        moved = true;
      } else {
        travel(x, y, nx, ny);
      }
      x = nx;
      y = ny;
    } else {
      return null;
    }
  }

  return moved ? Math.atan2(dirY, dirX) : null;
}

/** Direction of travel at the end of a circular SVG arc (centre from the endpoint parameterisation, SVG 1.1 F.6.5). */
function circularArcEndTangent(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  largeArc: boolean,
  sweep: boolean,
): { x: number; y: number } | null {
  const hx = (x0 - x1) / 2;
  const hy = (y0 - y1) / 2;
  const chordSq = hx * hx + hy * hy;
  if (chordSq < 1e-12 || radius < 1e-9) return null;
  // A radius too small for the chord is scaled up until the chord is a diameter.
  const r = Math.max(radius, Math.sqrt(chordSq));
  const radicand = Math.max(0, (r * r - chordSq) / chordSq);
  const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(radicand);
  const cx = coefficient * hy + (x0 + x1) / 2;
  const cy = -coefficient * hx + (y0 + y1) / 2;
  const radialX = x1 - cx;
  const radialY = y1 - cy;
  // Increasing angle (sweep flag set) runs clockwise on screen: tangent is the radius turned a quarter.
  return sweep ? { x: -radialY, y: radialX } : { x: radialY, y: -radialX };
}
