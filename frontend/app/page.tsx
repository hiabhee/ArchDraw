import type { Metadata } from 'next';
import RevampedLanding from '@/components/landing/RevampedLanding';

export const metadata: Metadata = {
  title: 'ArchDraw — Give your coding agent an architecture canvas',
  description:
    'Connect ArchDraw to your coding agent. Map a repository, explain system flows, and refine architecture on an editable canvas.',
  keywords: [
    'system architecture diagram',
    'architecture diagram tool',
    'system design diagram',
    'GitHub to diagram',
    'Mermaid diagram',
    'microservices diagram',
    'cloud architecture diagram',
    'AI diagram generator',
    'coding agent architecture tools',
  ],
  alternates: {
    canonical: 'https://archdraw.hiabhee.online/',
  },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/',
    title: 'ArchDraw — Give your coding agent an architecture canvas',
    description:
      'Map repositories, explain system flows, and refine architecture on an editable canvas with your coding agent.',
    siteName: 'ArchDraw',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw — system architecture diagram tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArchDraw — Give your coding agent an architecture canvas',
    description:
      'Connect ArchDraw to your coding agent to map repositories and explain system flows.',
    images: ['/api/og/home'],
  },
};

export default function LandingPage() {
  return <RevampedLanding />;
}
