import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ArchDraw Documentation | Architecture Diagram Guides',
  description:
    'Guides for generating, editing, arranging, and sharing architecture diagrams with ArchDraw.',
  keywords: [
    'ArchDraw documentation',
    'architecture diagram tool documentation',
    'MCP server guide',
    'system design tool guide',
  ],
  alternates: { canonical: 'https://archdraw.hiabhee.online/docs' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/docs',
    title: 'ArchDraw Documentation',
    description:
      'Getting started, node types, MCP server setup, prompt guide, API reference, and more.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Documentation' }],
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
