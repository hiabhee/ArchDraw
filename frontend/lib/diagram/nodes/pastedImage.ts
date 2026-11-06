/**
 * What a paste into the canvas becomes when it is an image: an ArchDraw preview or image link
 * (shown as that diagram, drawn in the editor's current look, with the link kept), or an
 * ordinary image URL.
 */
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';

export interface PastedImage {
  /** Image to show. */
  src: string;
  /** Where clicking it goes (the preview page), when there is one. */
  href?: string;
  caption?: string;
}

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;

/** Editor render style id → the `style` the image endpoint takes. */
export function imageStyleFor(renderStyle: DiagramRenderStyleId | string): string {
  return renderStyle === 'studio-minimal' ? 'studio' : renderStyle;
}

/**
 * `text` is the clipboard text. `current` is the editor's render style and light/dark mode, so a
 * pasted preview link is drawn the way the user's canvas looks. Returns undefined for anything
 * that is not an ArchDraw link or an image URL.
 */
export function parsePastedImage(
  text: string,
  current: { renderStyle: DiagramRenderStyleId | string; dark: boolean },
): PastedImage | undefined {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;

  const share = /^\/share\/([A-Za-z0-9_-]{8,64})\/?$/.exec(url.pathname);
  const image = /^\/api\/diagram\/image\/([A-Za-z0-9_-]{8,64})\/?$/.exec(url.pathname);
  const id = share?.[1] ?? image?.[1];
  if (id) {
    const params = new URLSearchParams({
      // A pasted image link keeps the look it was shared with; a preview link takes the editor's.
      style: image ? url.searchParams.get('style') ?? imageStyleFor(current.renderStyle) : imageStyleFor(current.renderStyle),
      theme: image ? url.searchParams.get('theme') ?? (current.dark ? 'dark' : 'light') : current.dark ? 'dark' : 'light',
      format: 'png',
    });
    return {
      src: `${url.origin}/api/diagram/image/${id}?${params}`,
      href: `${url.origin}/share/${id}`,
      caption: 'ArchDraw preview',
    };
  }
  if (IMAGE_FILE.test(url.pathname)) return { src: url.toString() };
  return undefined;
}
