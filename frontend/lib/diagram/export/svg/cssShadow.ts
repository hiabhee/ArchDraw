/**
 * Turns a CSS `box-shadow` list (the canvas draws cards with it) into an SVG filter that draws
 * the same shadow, so an exported card carries exactly the depth it has on the canvas. Inset
 * shadows are skipped (they sit inside the card and are not part of a drop shadow); spread
 * widens the shadow source by morphing it.
 */
interface ShadowLayer { x: number; y: number; blur: number; spread: number; color: string }

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  parts.push(value.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseBoxShadow(css: string | undefined | null): ShadowLayer[] {
  if (!css || css === 'none') return [];
  const layers: ShadowLayer[] = [];
  for (const part of splitTopLevel(css)) {
    if (/\binset\b/.test(part)) continue;
    const color = /(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(part)?.[1];
    if (!color) continue;
    const numbers = part.replace(color, ' ').match(/-?\d*\.?\d+(?=px|\s|$)/g)?.map(Number) ?? [];
    const [x = 0, y = 0, blur = 0, spread = 0] = numbers;
    layers.push({ x, y, blur: Math.max(0, blur), spread, color });
  }
  return layers;
}

/** `<filter>` that outputs only the shadow of the shape it is applied to (the card is drawn on top). */
export function buildShadowFilter(id: string, css: string | undefined | null): string {
  const layers = parseBoxShadow(css);
  if (!layers.length) return '';
  const reach = Math.max(...layers.map((l) => l.blur + Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.spread))) + 4;
  const parts = layers.map((l, i) => {
    const source = l.spread > 0
      ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${l.spread}" result="s${i}"/>`
      : `<feOffset in="SourceAlpha" dx="0" dy="0" result="s${i}"/>`;
    return `${source}<feGaussianBlur in="s${i}" stdDeviation="${l.blur / 2}" result="b${i}"/>` +
      `<feOffset in="b${i}" dx="${l.x}" dy="${l.y}" result="o${i}"/>` +
      `<feFlood flood-color="${l.color}" result="c${i}"/><feComposite in="c${i}" in2="o${i}" operator="in" result="l${i}"/>`;
  });
  const merge = layers.map((_, i) => `<feMergeNode in="l${i}"/>`).join('');
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-${reach}" y="-${reach}" width="3000" height="3000" color-interpolation-filters="sRGB">${parts.join('')}<feMerge>${merge}</feMerge></filter>`;
}
