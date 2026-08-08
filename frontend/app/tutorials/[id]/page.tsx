import type { Metadata } from 'next';
import { getTutorialById } from '@/data/tutorials';
import TutorialPageClient from './TutorialPageClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tutorial = getTutorialById(id);
  if (!tutorial) return { title: 'Tutorial Not Found | ArchFlow' };

  const keywords = [
    ...(tutorial.tags ?? []),
    'system design',
    'architecture diagram',
    'ArchFlow',
  ].join(', ');

  const ogImage = `/api/og/tutorial/${id}`;

  return {
    title: `${tutorial.title} | ArchDraw Tutorials`,
    description: tutorial.description,
    keywords,
    openGraph: {
      title: `${tutorial.title} | ArchDraw Tutorials`,
      description: tutorial.description,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: tutorial.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tutorial.title} | ArchDraw Tutorials`,
      description: tutorial.description,
      images: [ogImage],
    },
  };
}

export default function TutorialPage() {
  return <TutorialPageClient />;
}
