export const START_CTA_LABEL = 'Generate diagram';
export const START_CTA_HASH = '#generate';
export const FEATURED_REPO_URL = 'https://github.com/hiabhee/ArchDraw';

export function startCtaHref(pathname: string): string {
  return pathname === '/' ? START_CTA_HASH : `/${START_CTA_HASH}`;
}

export function editorGenerateHref(input: string): string {
  return `/editor?generate=${encodeURIComponent(input)}`;
}
