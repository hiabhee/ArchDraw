export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSolidArrowheadPath(
  tip: { x: number; y: number },
  angle: number,
  length = 14,
  width = 12,
): string {
  const backX = tip.x - Math.cos(angle) * length;
  const backY = tip.y - Math.sin(angle) * length;
  const normalX = Math.cos(angle + Math.PI / 2);
  const normalY = Math.sin(angle + Math.PI / 2);
  const halfWidth = width / 2;
  const left = {
    x: backX + normalX * halfWidth,
    y: backY + normalY * halfWidth,
  };
  const right = {
    x: backX - normalX * halfWidth,
    y: backY - normalY * halfWidth,
  };
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
