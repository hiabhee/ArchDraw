import type { Metadata } from 'next';
import RevampedLanding from '@/components/landing/RevampedLanding';

export const metadata: Metadata = {
  title: 'ArchDraw | Architecture diagrams from code and ideas',
  description:
    'Turn a public GitHub repository or system idea into an editable architecture diagram. Refine the graph in ArchDraw or connect a coding agent.',
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
    title: 'ArchDraw | Architecture diagrams from code and ideas',
    description:
      'Map public repositories or system ideas, then edit the architecture on a canvas or with a connected coding agent.',
    siteName: 'ArchDraw',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw system architecture diagram tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArchDraw | Architecture diagrams from code and ideas',
    description:
      'Map public repositories or system ideas, then edit the architecture on a canvas or with a connected coding agent.',
    images: ['/api/og/home'],
  },
};

export default function LandingPage() {
  return <RevampedLanding />;
}
