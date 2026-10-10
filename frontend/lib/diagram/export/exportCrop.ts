import type { Node } from 'reactflow';
import { getNodesBounds } from 'reactflow';

export interface ExportCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen-space crop rect for the diagram content inside `.react-flow`. */
export function computeDiagramCropRect(
  nodes: Node[],
  viewport: { x: number; y: number; zoom: number },
  paddingRatio = 0.1,
): ExportCropRect | null {
  if (nodes.length === 0) return null;

  const bounds = getNodesBounds(nodes);
  if (!bounds.width || !bounds.height) return null;

  const padW = bounds.width * paddingRatio;
  const padH = bounds.height * paddingRatio;
  const flowX = bounds.x - padW;
  const flowY = bounds.y - padH;
  const flowW = bounds.width + padW * 2;
  const flowH = bounds.height + padH * 2;
  const { x, y, zoom } = viewport;

  return {
    x: flowX * zoom + x,
    y: flowY * zoom + y,
    width: flowW * zoom,
    height: flowH * zoom,
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load export image'));
    img.src = dataUrl;
  });
}

export async function cropRasterDataUrl(
  dataUrl: string,
  crop: ExportCropRect,
  pixelRatio: number,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality?: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(dataUrl);
  const sx = Math.max(0, Math.round(crop.x * pixelRatio));
  const sy = Math.max(0, Math.round(crop.y * pixelRatio));
  const sw = Math.min(Math.round(crop.width * pixelRatio), img.width - sx);
  const sh = Math.min(Math.round(crop.height * pixelRatio), img.height - sy);

  if (sw <= 0 || sh <= 0) {
    return { dataUrl, width: img.width / pixelRatio, height: img.height / pixelRatio };
  }

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl, width: img.width / pixelRatio, height: img.height / pixelRatio };
  }
  // High-quality downscale for cropped PNG – keeps text sharp after crop
  ctx.imageSmoothingEnabled = true;
  (ctx as unknown as { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high';

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const out =
    mime === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', quality ?? 0.9)
      : canvas.toDataURL('image/png');

  return { dataUrl: out, width: sw / pixelRatio, height: sh / pixelRatio };
}
