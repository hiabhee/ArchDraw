/**
 * Makes a picture small enough to live inside a diagram. An image placed on the canvas is stored
 * with the diagram (autosave, share, localStorage), so a phone photo or a 4K screenshot is
 * shrunk and re-encoded here instead of being refused. Browser only.
 */

/** Longest side kept, in px: sharp on a large screen, far smaller than a camera original. */
export const MAX_IMAGE_SIDE = 1600;
/** Aim for a stored size under this many bytes (the encoded bytes, before base64). */
export const TARGET_IMAGE_BYTES = 450_000;
/** Biggest original read at all. */
export const MAX_ORIGINAL_BYTES = 40_000_000;

export interface PreparedImage {
  /** `data:` URL ready for the node. */
  src: string;
  /** Size to draw at, from the original proportions. */
  width: number;
  height: number;
}

/** Longest side first, then the target fitted into `max` keeping proportions. Pure, for tests. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Rough size of the bytes behind a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

function load(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    image.src = url;
  });
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Sample a coarse grid: enough to tell a logo with an alpha channel from a photo.
  const step = Math.max(1, Math.floor(Math.max(width, height) / 40));
  for (let y = 0; y < height; y += step) {
    const row = context.getImageData(0, y, width, 1).data;
    for (let x = 0; x < width; x += step) if (row[x * 4 + 3] < 250) return true;
  }
  return false;
}

/**
 * Reads an image file and returns a data URL within `targetBytes`: scaled down to
 * `maxSide`, re-encoded as WebP (or PNG when it has transparency and still fits), lowering the
 * quality and then the size until it fits. Small images pass through untouched.
 */
export async function prepareImage(file: Blob, options: { maxSide?: number; targetBytes?: number } = {}): Promise<PreparedImage> {
  const maxSide = options.maxSide ?? MAX_IMAGE_SIDE;
  const targetBytes = options.targetBytes ?? TARGET_IMAGE_BYTES;
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error('That image is too large to open (limit 40 MB).');

  const image = await load(file);
  const natural = { width: image.naturalWidth || 1, height: image.naturalHeight || 1 };
  const display = fitWithin(natural.width, natural.height, maxSide);

  // Already small and not oversized: keep the original bytes (and an animated GIF's frames).
  if (file.size <= targetBytes && display.width === natural.width && display.height === natural.height) {
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.readAsDataURL(file);
    });
    return { src, width: natural.width, height: natural.height };
  }

  const draw = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot resize images.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    return { canvas, context };
  };

  let { width, height } = display;
  let { canvas, context } = draw(width, height);
  const transparent = hasTransparency(context, width, height);

  let best = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    // PNG keeps transparency crisp but cannot be tuned, so it is only tried first and at full size.
    const png = transparent && attempt === 0 ? canvas.toDataURL('image/png') : '';
    if (png && dataUrlBytes(png) <= targetBytes) return { src: png, width: display.width, height: display.height };
    const quality = Math.max(0.5, 0.9 - attempt * 0.07);
    // WebP carries alpha too, so transparent images stay transparent when PNG was too big.
    best = canvas.toDataURL('image/webp', quality);
    if (!best.startsWith('data:image/webp')) best = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(best) <= targetBytes) break;
    if (attempt >= 2) {
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
      ({ canvas, context } = draw(width, height));
    }
  }
  return { src: best, width: display.width, height: display.height };
}
