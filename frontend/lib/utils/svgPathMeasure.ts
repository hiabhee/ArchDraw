/**
 * Reusable off-screen SVG path for getTotalLength / getPointAtLength.
 * Avoids appending/removing a hidden SVG on every call (which caused edge flicker
 * when many edges measured paths during the same React render).
 */
let measureRoot: SVGSVGElement | null = null;
let measurePathEl: SVGPathElement | null = null;

function getMeasurePath(): SVGPathElement | null {
  if (typeof window === 'undefined') return null;
  if (!measureRoot) {
    measureRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measureRoot.setAttribute('aria-hidden', 'true');
    measureRoot.style.cssText =
      'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
    document.body.appendChild(measureRoot);
    measurePathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    measureRoot.appendChild(measurePathEl);
  }
  return measurePathEl;
}

export function withSvgPath<T>(pathD: string, fn: (path: SVGPathElement) => T, fallback: T): T {
  const path = getMeasurePath();
  if (!path) return fallback;
  try {
    path.setAttribute('d', pathD);
    return fn(path);
  } catch {
    return fallback;
  }
}
