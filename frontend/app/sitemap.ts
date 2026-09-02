import type { MetadataRoute } from 'next';
import { TUTORIALS } from '@/data/tutorials';
import { blogs } from '@/data/blogs';

// Sitemap: canonical URLs only. `/learn/*` route does not exist — removed 2026-09-02 (was doubling sitemap size + 404s in Search Console).
// `lastModified` uses stable build-time date so sitemap is cacheable (previously `new Date()` per entry → ETag churn).
const BUILD_DATE = new Date('2026-09-02T00:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archdraw.hiabhee.online';

  const tutorialEntries: MetadataRoute.Sitemap = TUTORIALS.map((t) => ({
    url: `${base}/tutorials/${t.id}`,
    lastModified: BUILD_DATE,
    changeFrequency: 'monthly',
    priority: 0.9,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogs.map((b) => ({
    url: `${base}/blogs/${b.slug}`,
    lastModified: BUILD_DATE,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [
    { url: base, lastModified: BUILD_DATE, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/docs`, lastModified: BUILD_DATE, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/blogs`, lastModified: BUILD_DATE, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/mcp`, lastModified: BUILD_DATE, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/repo-diagram`, lastModified: BUILD_DATE, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tutorials`, lastModified: BUILD_DATE, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/editor`, lastModified: BUILD_DATE, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`, lastModified: BUILD_DATE, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: BUILD_DATE, changeFrequency: 'yearly', priority: 0.3 },
    ...blogEntries,
    ...tutorialEntries,
  ];
}
