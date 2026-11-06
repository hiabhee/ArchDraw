/** Blend two `#rrggbb` colors into a fully opaque `rgb()`. `t` is the fraction of the first. Other formats come back unchanged. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-fA-F]{6})$/.exec(a);
  const pb = /^#([0-9a-fA-F]{6})$/.exec(b);
  if (!pa || !pb) return a;
  const na = parseInt(pa[1], 16);
  const nb = parseInt(pb[1], 16);
  const r = Math.round(((na >> 16) & 0xff) * t + ((nb >> 16) & 0xff) * (1 - t));
  const g = Math.round(((na >> 8) & 0xff) * t + ((nb >> 8) & 0xff) * (1 - t));
  const bl = Math.round((na & 0xff) * t + (nb & 0xff) * (1 - t));
  return `rgb(${r}, ${g}, ${bl})`;
}
