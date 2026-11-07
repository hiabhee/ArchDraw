import type { Metadata } from 'next';
import { TUTORIALS, getTutorialById } from '@/data/tutorials';
import TutorialPageClient from './TutorialPageClient';
import { TutorialArticle } from '@/components/tutorial/TutorialArticle';
import { Footer } from '@/components/landing/Footer';
import { pageMetadata } from '@/lib/site/seo';
import { tutorialHeading, tutorialMetaDescription, tutorialMetaTitle, tutorialSubject } from '@/lib/tutorial/tutorialArticle';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return TUTORIALS.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tutorial = getTutorialById(id);
  if (!tutorial) return { title: 'Tutorial not found', robots: { index: false } };
  const subject = tutorialSubject(tutorial);

  return pageMetadata({
    title: tutorialMetaTitle(tutorial),
    description: tutorialMetaDescription(tutorial),
    path: `/tutorials/${id}`,
    type: 'article',
    image: `/api/og/tutorial/${id}`,
    imageAlt: tutorialHeading(tutorial),
    keywords: [
      `${subject} system design`,
      `how to design ${subject}`,
      `${subject} architecture`,
      'system design tutorial',
      'system design interview',
      ...(tutorial.tags ?? []),
    ],
  });
}

export default async function TutorialPage({ params }: Props) {
  const { id } = await params;
  const tutorial = getTutorialById(id);
  return (
    <>
      <TutorialPageClient />
      {tutorial && (
        <>
          <TutorialArticle tutorial={tutorial} />
          <Footer />
        </>
      )}
    </>
  );
}
