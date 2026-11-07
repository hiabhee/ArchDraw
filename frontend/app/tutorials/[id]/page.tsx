import type { Metadata } from 'next';
import { getTutorialById } from '@/data/tutorials';
import TutorialPageClient from './TutorialPageClient';
import { pageMetadata } from '@/lib/site/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tutorial = getTutorialById(id);
  if (!tutorial) return { title: 'Tutorial not found', robots: { index: false } };

  const keywords = [
    ...(tutorial.tags ?? []),
    'system design',
    'architecture diagram',
    'ArchDraw',
  ].join(', ');

  const ogImage = `/api/og/tutorial/${id}`;

  return {
    ...pageMetadata({
      title: `${tutorial.title} — System Design Tutorial`,
      description: tutorial.description,
      path: `/tutorials/${id}`,
      type: 'article',
      image: ogImage,
      imageAlt: tutorial.title,
    }),
    keywords,
  };
}

export default function TutorialPage() {
  return <TutorialPageClient />;
}
