import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/site/discovery';

/** The shared social card; pages without their own image use it. */
export const DEFAULT_OG_IMAGE = '/api/og/home';

/** The square brand mark (Organization logo in structured data, manifest icons). */
export const LOGO_URL = `${SITE_URL}/logo.png`;

/** Absolute URL for a site path (`/pricing` → `https://…/pricing`). */
export function absoluteUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface PageMetadataInput {
  /** Page title without the brand: the root layout's template appends `| ArchDraw`. */
  title: string;
  description: string;
  /** Site path of the page, used for the canonical URL and `og:url`. */
  path: string;
  /** Social title when it should differ from the page title (defaults to `title — ArchDraw`). */
  socialTitle?: string;
  type?: 'website' | 'article';
  image?: string;
  imageAlt?: string;
  keywords?: string[];
  /** Private or per-user pages: keep them out of search results. */
  noIndex?: boolean;
}

/**
 * Metadata for one page: title, canonical URL, Open Graph and Twitter card in step, so no
 * page falls back to the homepage's canonical (which tells search engines the page is a
 * duplicate of `/`).
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const socialTitle = input.socialTitle ?? `${input.title} — ${SITE_NAME}`;
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const imageAlt = input.imageAlt ?? socialTitle;
  return {
    title: input.title,
    description: input.description,
    ...(input.keywords ? { keywords: input.keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: input.type ?? 'website',
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      title: socialTitle,
      description: input.description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: input.description,
      images: [image],
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** `BreadcrumbList` structured data for a page trail (`[['Templates', '/templates'], …]`). */
export function breadcrumbJsonLd(trail: Array<[name: string, path: string]>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'] as [string, string], ...trail].map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}
