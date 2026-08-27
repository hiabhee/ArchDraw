import { getRenderStyle } from './registry';

const LEGACY_LINK_ID = 'arch-sketch-font';

/**
 * Inject the sketch Google Font stylesheet. Supports multi-family slugs
 * (e.g. `Patrick+Hand&family=Caveat:wght@500;700`) and sanitizes each
 * family for the link id. Keeps next/font self-hosted as primary — this
 * link is a CDN fallback for fast sketch toggle without bundle reload.
 */
export function ensureSketchFontLoaded(): void {
  if (typeof document === 'undefined') return;

  const googleFamily = getRenderStyle('sketch').fonts.googleFontFamily;
  if (!googleFamily) return;

  const href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`;
  const safe = googleFamily.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const linkId = `arch-sketch-font-${safe}`;

  document.getElementById(LEGACY_LINK_ID)?.remove();

  const existing = document.getElementById(linkId) as HTMLLinkElement | null;
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.appendChild(link);
}
