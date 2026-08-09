/**
 * SVG body paths for semantic ShapeNode silhouettes.
 * Geometry aligned with `components/ShapeNode.tsx` for canvas ↔ export parity.
 */

export interface ShapeSurfaceSvg {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function cloudSilhouettePath(W: number, H: number): string {
  const s = W / 200;
  const pt = (x: number, y: number) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`;
  const R = (r: number) => (r * s).toFixed(1);
  return [
    `M ${pt(44, 102)}`,
    `A ${R(26)} ${R(26)} 0 0 1 ${pt(34, 68)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(82, 34)}`,
    `A ${R(34)} ${R(34)} 0 0 1 ${pt(148, 42)}`,
    `A ${R(30)} ${R(30)} 0 0 1 ${pt(170, 78)}`,
    `A ${R(24)} ${R(24)} 0 0 1 ${pt(156, 102)}`,
    'Z',
  ].join(' ');
}

export function hexagonBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const inset = 2;
  const qx = Math.max(10, Math.round(W * 0.22));
  const pts = [
    `${qx},${inset}`,
    `${W - qx},${inset}`,
    `${W - inset},${H / 2}`,
    `${W - qx},${H - inset}`,
    `${qx},${H - inset}`,
    `${inset},${H / 2}`,
  ].join(' ');
  return `<polygon points="${pts}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-linejoin="round" />`;
}

export function cloudBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const d = cloudSilhouettePath(W, H);
  return `<path d="${d}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-linejoin="round" />`;
}

export function shieldBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const inset = 2;
  const topY = Math.max(5, Math.round(H * 0.05));
  const d = [
    `M ${W / 2} ${topY}`,
    `L ${W - inset} ${Math.round(H * 0.3)}`,
    `Q ${W - inset} ${Math.round(H * 0.62)} ${W / 2} ${H - inset}`,
    `Q ${inset} ${Math.round(H * 0.62)} ${inset} ${Math.round(H * 0.3)}`,
    'Z',
  ].join(' ');
  return `<path d="${d}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-linejoin="round" />`;
}

export function actorBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const headCY = Math.round(H * 0.3);
  const headR = Math.max(8, Math.round(H * 0.17));
  const shoulderY = Math.round(H * 0.95);
  const shoulderSweepX = Math.round(W * 0.28);
  const shoulders = [
    `M ${W / 2 - shoulderSweepX} ${shoulderY}`,
    `A ${shoulderSweepX} ${Math.round(H * 0.22)} 0 0 1 ${W / 2 + shoulderSweepX} ${shoulderY}`,
    'Z',
  ].join(' ');
  return `
    <ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - 2}" ry="${H / 2 - 2}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
    <circle cx="${W / 2}" cy="${headCY}" r="${headR}" fill="none" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
    <path d="${shoulders}" fill="none" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-linecap="round" />
  `.trim();
}

export function monitorBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const inset = 2;
  const screenH = H - 20;
  const screenR = 6;
  const screen = [
    `M ${inset} ${inset + screenR}`,
    `Q ${inset} ${inset} ${inset + screenR} ${inset}`,
    `L ${W - inset - screenR} ${inset}`,
    `Q ${W - inset} ${inset} ${W - inset} ${inset + screenR}`,
    `L ${W - inset} ${inset + screenH}`,
    `Q ${W - inset} ${inset + screenH} ${W - inset - 4} ${inset + screenH}`,
    `L ${inset + 4} ${inset + screenH}`,
    `Q ${inset} ${inset + screenH} ${inset} ${inset + screenH}`,
    'Z',
  ].join(' ');
  const neckY = inset + screenH;
  const standW = Math.round(W * 0.32);
  return `
    <path d="${screen}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-linejoin="round" />
    <line x1="${W / 2}" y1="${neckY}" x2="${W / 2}" y2="${neckY + 6}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
    <rect x="${W / 2 - Math.round(W * 0.16)}" y="${neckY + 6}" width="${standW}" height="3" rx="1.5" fill="${surface.stroke}" />
  `.trim();
}

export function mobileBodySvg(W: number, H: number, surface: ShapeSurfaceSvg): string {
  const inset = 2;
  const r = Math.max(6, Math.round(W * 0.09));
  return `
    <rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" rx="${r}" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" />
    <rect x="${W / 2 - 8}" y="${Math.round(H * 0.1)}" width="16" height="3" rx="1.5" fill="${surface.stroke}" opacity="0.7" />
    <line x1="${W / 2}" y1="${H - Math.round(H * 0.12)}" x2="${W / 2}" y2="${H - Math.round(H * 0.05)}" stroke="${surface.stroke}" stroke-width="2" stroke-linecap="round" />
  `.trim();
}

export function dashedRectangleBodySvg(W: number, H: number, surface: ShapeSurfaceSvg, isDark: boolean): string {
  const fill = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)';
  return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" ry="10" fill="${fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" stroke-dasharray="6 4" />`;
}

/** Returns SVG markup for semantic silhouettes; null when shape is not handled here. */
export function semanticShapeBodySvg(
  shape: string,
  W: number,
  H: number,
  surface: ShapeSurfaceSvg,
  isDark = false,
): string | null {
  switch (shape) {
    case 'hexagon':
      return hexagonBodySvg(W, H, surface);
    case 'cloud':
      return cloudBodySvg(W, H, surface);
    case 'shield':
      return shieldBodySvg(W, H, surface);
    case 'actor':
      return actorBodySvg(W, H, surface);
    case 'monitor':
      return monitorBodySvg(W, H, surface);
    case 'mobile':
      return mobileBodySvg(W, H, surface);
    case 'dashed-rectangle':
      return dashedRectangleBodySvg(W, H, surface, isDark);
    default:
      return null;
  }
}
