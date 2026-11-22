const MAX_RASTER_SIDE = 16_384;
const MAX_RASTER_PIXELS = 48_000_000;

export function maxRasterScale(width: number, height: number): number {
  return Math.min(MAX_RASTER_SIDE / Math.max(width, height), Math.sqrt(MAX_RASTER_PIXELS / (width * height)));
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error('SVG image decode timed out')), 10_000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Could not decode the export image'));
    };
    image.src = src;
  });
}

export async function rasterizeExportSvg(svg: string, desiredScale: number): Promise<{ dataUrl: string; pixelRatio: number }> {
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0];
  const width = Number(root?.match(/\swidth="([\d.]+)"/)?.[1]);
  const height = Number(root?.match(/\sheight="([\d.]+)"/)?.[1]);
  if (!root || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid SVG dimensions');
  }

  let pixelRatio = Math.min(desiredScale, maxRasterScale(width, height));
  let lastError: unknown;
  // Keep the SVG viewBox in diagram units and ask the decoder to paint at output resolution.
  // This also scales HTML inside a foreignObject before the browser renders the text.
  for (let attempt = 0; attempt < 3; attempt += 1, pixelRatio *= 0.7) {
    const outputWidth = Math.max(1, Math.floor(width * pixelRatio));
    const outputHeight = Math.max(1, Math.floor(height * pixelRatio));
    const sizedRoot = root.replace(/\swidth="[\d.]+"/, ` width="${outputWidth}"`)
      .replace(/\sheight="[\d.]+"/, ` height="${outputHeight}"`);
    const markup = root.includes(' viewBox=') ? sizedRoot : sizedRoot.replace(/>$/, ` viewBox="0 0 ${width} ${height}">`);
    const canvas = document.createElement('canvas');
    try {
      const image = await decodeImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup + svg.slice(root.length))}`);
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not allocate an export canvas');
      ctx.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl.startsWith('data:image/png')) throw new Error('Could not encode the export image');
      return { dataUrl, pixelRatio };
    } catch (error) {
      lastError = error;
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  throw lastError;
}
