import { getRenderStyle } from './registry';

const LEGACY_LINK_ID = 'arch-sketch-font';

/**
 * Inject the sketch Google Font stylesheet. Removes the legacy single-id link
 * so font family changes apply without a hard refresh.
 */
export function ensureSketchFontLoaded(): void {
  if (typeof document === 'undefined') return;

  const googleFamily = getRenderStyle('sketch').fonts.googleFontFamily;
  if (!googleFamily) return;

  const href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`;
  const linkId = `arch-sketch-font-${googleFamily.replace(/\+/g, '-').toLowerCase()}`;

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
