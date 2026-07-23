import { Metadata } from 'next';
import EmbedPageClient from './EmbedPageClient';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://archdraw.hiabhee.online';
  
  return {
    title: 'ArchDraw Diagram',
    description: 'Interactive architecture diagram created with ArchDraw',
    keywords: ['architecture', 'diagram', 'system design', 'archdraw'],
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: 'website',
      title: 'ArchDraw Diagram',
      description: 'Interactive architecture diagram',
      url: `${appUrl}/embed/${id}`,
      siteName: 'ArchDraw',
      images: [
        {
          url: `${appUrl}/api/og/${id}`,
          width: 1200,
          height: 630,
          alt: 'Architecture Diagram',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'ArchDraw Diagram',
      description: 'Interactive architecture diagram',
    },
    other: {
      'og:type': 'website',
      'og:url': `${appUrl}/embed/${id}`,
      'twitter:card': 'summary_large_image',
    },
  };
}

export default async function EmbedPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  return (
    <EmbedPageClient 
      id={resolvedParams.id}
      searchParams={resolvedSearchParams}
    />
  );
}
