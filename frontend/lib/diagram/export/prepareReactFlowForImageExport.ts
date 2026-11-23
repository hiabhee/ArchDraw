/**
 * Helpers for capturing and encoding the offscreen export canvas.
 */

type BgType = 'dark' | 'light' | 'transparent';

/** Inline SVG attributes for the offscreen copy. The image decoder has no page stylesheet. */
export function prepareReactFlowForImageExport(root: HTMLElement): void {
  for (const path of root.querySelectorAll<SVGPathElement>('.react-flow__edge-path')) {
    const computed = getComputedStyle(path);
    path.setAttribute('stroke-dasharray', computed.strokeDasharray);
    path.setAttribute('stroke', computed.stroke);
    path.setAttribute('stroke-width', computed.strokeWidth);
    path.setAttribute('opacity', computed.opacity);
    path.setAttribute('fill', 'none');
  }
}

/** Keep diagram content and its grid. Exclude controls and handles from the image. */
export function reactFlowExportFilter(node: HTMLElement): boolean {
  const cls = node.classList;
  if (!cls) return true;
  if (
    cls.contains('react-flow__minimap') ||
    cls.contains('react-flow__controls') ||
    cls.contains('react-flow__panel')
  ) {
    return false;
  }
  // Hide all connection handles (both ReactFlow and custom floating handles) and
  // node chrome that should not appear in a downloaded diagram.
  if (
    cls.contains('react-flow__handle') ||
    cls.contains('rh') ||
    cls.contains('node-toolbar') ||
    cls.contains('group-resize-handle') ||
    cls.contains('live-activity-overlay')
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

/** Decode the raster without an extra image draw or a CSP-sensitive fetch of a data URL. */
export function pngDataUrlToBlob(dataUrl: string): Blob {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('Invalid PNG data URL');
  const characters = atob(dataUrl.slice(prefix.length));
  const bytes = new Uint8Array(characters.length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = characters.charCodeAt(index);
  return new Blob([bytes], { type: 'image/png' });
}
