import type { Metadata } from 'next';
import { TUTORIALS } from '@/data/tutorials';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';
import { tutorialHeading } from '@/lib/tutorial/tutorialArticle';
import TutorialsPageClient from './TutorialsPageClient';

export const metadata: Metadata = pageMetadata({
  title: 'System Design Tutorials (Free, Interactive)',
  description: `${TUTORIALS.length} free, interactive system design tutorials. Learn how to design ChatGPT, WhatsApp, Netflix, Uber and more, step by step, with every trade-off explained.`,
  path: '/tutorials',
  keywords: ['system design', 'system design tutorial', 'learn system design', 'system design interview', 'how to design', 'system design examples'],
});

export default function TutorialsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${absoluteUrl('/tutorials')}#page`,
        name: 'System Design Tutorials',
        url: absoluteUrl('/tutorials'),
        about: 'System design',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: TUTORIALS.length,
          itemListElement: TUTORIALS.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: tutorialHeading(t),
            url: absoluteUrl(`/tutorials/${t.id}`),
          })),
        },
      },
      breadcrumbJsonLd([['System design tutorials', '/tutorials']]),
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TutorialsPageClient />
    </>
  );
}
