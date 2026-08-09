/**
 * SVG export uses a compressed raster inside a minimal SVG wrapper.
 * foreignObject DOM clones routinely exceed 7MB+ on real diagrams; this
 * matches the PNG export look while staying under the size budget.
 */

import type { Options } from 'html-to-image/lib/types';
import { reactFlowExportFilter } from '@/lib/utils/prepareReactFlowForImageExport';
import type { ExportCropRect } from '@/lib/utils/exportCrop';
import { cropRasterDataUrl } from '@/lib/utils/exportCrop';

export const MAX_SVG_EXPORT_BYTES = 3 * 1024 * 1024;

export function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return new Blob([value]).size;
}

export function wrapRasterInSvg(
  imageDataUrl: string,
  width: number,
  height: number,
  backgroundColor?: string,
): string {
  const bgRect = backgroundColor
    ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bgRect}
  <image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="${imageDataUrl}" />
</svg>`.trim();
}

type RasterAttempt = {
  pixelRatio?: number;
  quality?: number;
  format: 'jpeg' | 'png';
  width?: number;
  height?: number;
};

function buildRasterAttempts(
  width: number,
  height: number,
  hasBackground: boolean,
): RasterAttempt[] {
  const attempts: RasterAttempt[] = hasBackground
    ? [
        { pixelRatio: 2, quality: 0.9, format: 'jpeg' },
        { pixelRatio: 2, quality: 0.78, format: 'jpeg' },
        { pixelRatio: 1.5, quality: 0.72, format: 'jpeg' },
        { pixelRatio: 1.25, quality: 0.66, format: 'jpeg' },
        { pixelRatio: 1, quality: 0.58, format: 'jpeg' },
      ]
    : [
        { pixelRatio: 2, format: 'png' },
        { pixelRatio: 1.5, format: 'png' },
        { pixelRatio: 1, format: 'png' },
      ];

  const maxDim = Math.max(width, height);
  if (hasBackground && maxDim > 1600) {
    const scale = 1600 / maxDim;
    attempts.push({
      pixelRatio: 1,
      quality: 0.55,
      format: 'jpeg',
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
  }
  if (hasBackground && maxDim > 1200) {
    const scale = 1200 / maxDim;
    attempts.push({
      pixelRatio: 1,
      quality: 0.48,
      format: 'jpeg',
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
  }

  if (!hasBackground && maxDim > 1400) {
    const scale = 1400 / maxDim;
    attempts.push({
      pixelRatio: 1,
      format: 'png',
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
  }

  return attempts;
}

async function captureRasterDataUrl(
  element: HTMLElement,
  attempt: RasterAttempt,
  options: CaptureSvgOptions,
): Promise<string> {
  const captureOptions: Options = {
    backgroundColor: options.backgroundColor,
    cacheBust: options.cacheBust ?? true,
    skipFonts: true,
    pixelRatio: attempt.pixelRatio ?? 2,
    width: attempt.width,
    height: attempt.height,
    filter: (node) => reactFlowSvgExportFilter(node as HTMLElement),
  };

  if (attempt.format === 'jpeg') {
    const { toJpeg } = await import('html-to-image');
    return toJpeg(element, { ...captureOptions, quality: attempt.quality ?? 0.85 });
  }

  const { toPng } = await import('html-to-image');
  return toPng(element, captureOptions);
}

export interface CaptureSvgOptions {
  backgroundColor?: string;
  cacheBust?: boolean;
  crop?: ExportCropRect | null;
  pixelRatio?: number;
}

export async function captureReactFlowSvg(
  element: HTMLElement,
  options: CaptureSvgOptions = {},
): Promise<string> {
  const width = element.clientWidth;
  const height = element.clientHeight;
  const hasBackground = Boolean(options.backgroundColor);
  const attempts = buildRasterAttempts(width, height, hasBackground);
  const pixelRatio = options.pixelRatio ?? (hasBackground ? 2 : 2);

  let smallest = '';
  let smallestBytes = Infinity;

  for (const attempt of attempts) {
    const mergedAttempt: RasterAttempt = {
      ...attempt,
      pixelRatio: options.pixelRatio ?? attempt.pixelRatio ?? 2,
    };
    const dataUrl = await captureRasterDataUrl(element, mergedAttempt, options);
    let outUrl = dataUrl;
    let outW = width;
    let outH = height;

    if (options.crop) {
      const mime = hasBackground ? 'image/jpeg' : 'image/png';
      const quality = mergedAttempt.quality;
      const cropped = await cropRasterDataUrl(
        dataUrl,
        options.crop,
        mergedAttempt.pixelRatio ?? 2,
        mime,
        quality,
      );
      outUrl = cropped.dataUrl;
      outW = cropped.width;
      outH = cropped.height;
    }

    const svg = wrapRasterInSvg(outUrl, outW, outH, options.backgroundColor);
    const bytes = getUtf8ByteLength(svg);
    if (bytes < smallestBytes) {
      smallest = svg;
      smallestBytes = bytes;
    }
    if (bytes <= MAX_SVG_EXPORT_BYTES) {
      return svg;
    }
  }

  return smallest;
}

/** Hide wide invisible edge hit-targets and other non-visual export chrome. */
export function reactFlowSvgExportFilter(node: HTMLElement): boolean {
  if (!reactFlowExportFilter(node)) return false;
  if (node.classList?.contains('react-flow__edge-interaction')) return false;
  if (node instanceof SVGPathElement) {
    const stroke = node.getAttribute('stroke');
    const strokeWidth = Number(node.getAttribute('stroke-width') ?? 0);
    if (stroke === 'transparent' || strokeWidth >= 12) return false;
  }
  return true;
}
