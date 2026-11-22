import { buildExportFontCss } from './embedFonts';
import { escapeXml } from './svgPrimitives';

async function readImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Make editable SVGs portable with the fonts and images accessible to the editor. */
export async function embedExportAssets(svg: string): Promise<string> {
  const images = new Set([...svg.matchAll(/<image\b[^>]*\bhref="(https?:[^\"]+)"/g)].map((match) => match[1]));
  const [fontCss, sources] = await Promise.all([
    buildExportFontCss(),
    Promise.all([...images].map(async (url) => [url, await readImageDataUrl(url.replaceAll('&amp;', '&'))] as const)),
  ]);
  let result = fontCss ? svg.replace(/^(<svg\b[^>]*>)/, (_, root) => `${root}<style>${escapeXml(fontCss)}</style>`) : svg;
  for (const [url, dataUrl] of sources) {
    if (dataUrl) result = result.replaceAll(`href="${url}"`, `href="${escapeXml(dataUrl)}"`);
  }
  return result;
}
