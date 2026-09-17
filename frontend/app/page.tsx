import type { Metadata } from 'next';
import RevampedLanding from '@/components/landing/RevampedLanding';

export const metadata: Metadata = {
  title: 'ArchDraw — See your codebase as a system',
  description:
    'Turn a GitHub repository, Mermaid, or plain English into an editable system architecture diagram. Auto-laid-out, shareable, export to PNG, SVG and live link — free during beta.',
  keywords: [
    'system architecture diagram',
    'architecture diagram tool',
    'system design diagram',
    'GitHub to diagram',
    'Mermaid diagram',
    'microservices diagram',
    'cloud architecture diagram',
    'AI diagram generator',
  ],
  alternates: {
    canonical: 'https://archdraw.hiabhee.online/',
  },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/',
    title: 'ArchDraw — See your codebase as a system',
    description:
      'Turn a GitHub repository, Mermaid, or plain English into an editable architecture map your team can understand at a glance.',
    siteName: 'ArchDraw',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw — system architecture diagram tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArchDraw — See your codebase as a system',
    description:
      'Turn a GitHub repository, Mermaid, or plain English into an editable architecture map.',
    images: ['/api/og/home'],
  },
};

export default function LandingPage() {
  return <RevampedLanding />;
}
