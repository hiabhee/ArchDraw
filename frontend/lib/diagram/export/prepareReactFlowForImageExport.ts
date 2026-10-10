/**
 * Shared DOM capture prep for PNG / SVG export via html-to-image.
 * Clones the live canvas subtree so exports match what users see.
 */

type BgType = 'dark' | 'light' | 'transparent';

interface PathSnapshot {
  path: SVGPathElement;
  attributes: Record<string, string | null>;
}

function snapshotPath(path: SVGPathElement): PathSnapshot {
  const names = ['stroke-dasharray', 'stroke', 'stroke-width', 'opacity', 'fill', 'marker-end', 'marker-start'];
  const attributes: Record<string, string | null> = {};
  for (const name of names) {
    attributes[name] = path.hasAttribute(name) ? path.getAttribute(name) : null;
  }
  return { path, attributes };
}

function restorePathSnapshots(snapshots: PathSnapshot[]): void {
  for (const { path, attributes } of snapshots) {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) path.removeAttribute(name);
      else path.setAttribute(name, value);
    }
  }
}

/**
 * Inline computed styles onto SVG edge paths before html-to-image export.
 */
export function prepareReactFlowForImageExport(root: HTMLElement): PathSnapshot[] {
  const snapshots: PathSnapshot[] = [];
  const paths = root.querySelectorAll<SVGPathElement>('.react-flow__edge-path');
  paths.forEach((path) => {
    snapshots.push(snapshotPath(path));
    const computed = window.getComputedStyle(path);
    const dash = path.style.strokeDasharray || computed.strokeDasharray;
    if (dash && dash !== 'none') {
      path.setAttribute('stroke-dasharray', dash);
    }
    const stroke = path.style.stroke || computed.stroke;
    if (stroke) path.setAttribute('stroke', stroke);
    const strokeWidth = path.style.strokeWidth || computed.strokeWidth;
    if (strokeWidth) path.setAttribute('stroke-width', strokeWidth);
    const opacity = path.style.opacity || computed.opacity;
    if (opacity && opacity !== '1') path.setAttribute('opacity', opacity);
    path.setAttribute('fill', 'none');
    const markerEnd = path.getAttribute('marker-end');
    if (markerEnd) path.setAttribute('marker-end', markerEnd);
    const markerStart = path.getAttribute('marker-start');
    if (markerStart) path.setAttribute('marker-start', markerStart);
  });
  return snapshots;
}

export function restoreReactFlowAfterImageExport(snapshots: PathSnapshot[]): void {
  restorePathSnapshots(snapshots);
}

/** Skip minimap, controls, dot background and handles — handles must never leak into exported PNG. */
export function reactFlowExportFilter(node: HTMLElement): boolean {
  const cls = node.classList;
  if (!cls) return true;
  if (
    cls.contains('react-flow__minimap') ||
    cls.contains('react-flow__controls') ||
    cls.contains('react-flow__panel') ||
    cls.contains('react-flow__background')
  ) {
    return false;
  }
  // Hide all connection handles (both ReactFlow and custom floating handles) and
  // node chrome that should not appear in a downloaded diagram.
  if (
    cls.contains('react-flow__handle') ||
    cls.contains('rh') ||
    cls.contains('node-toolbar') ||
    cls.contains('group-resize-handle')
  ) {
    return false;
  }
  return true;
}

export function decodeSvgDataUrl(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const comma = dataUrl.indexOf(',');
  const payload = dataUrl.slice(comma + 1);
  const header = dataUrl.slice(0, comma);
  if (header.includes('base64')) return atob(payload);
  return decodeURIComponent(payload);
}

/** Read the canvas host background so light exports match the editor surface. */
export function resolveExportBackgroundColor(
  bgType: BgType,
  reactFlowRoot: HTMLElement,
): string | undefined {
  if (bgType === 'transparent') return undefined;
  if (bgType === 'dark') return '#000000';

  const canvasHost = reactFlowRoot.parentElement;
  if (canvasHost) {
    const bg = window.getComputedStyle(canvasHost).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
  }
  return '#ffffff';
}

export async function waitForReactFlowFrame(ms = 400): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}
