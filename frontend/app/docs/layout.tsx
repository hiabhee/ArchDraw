import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation — User Guide & API Reference',
  description:
    'ArchDraw documentation: getting started, node types, diagram types, MCP server setup, prompt guide, API reference, and keyboard shortcuts.',
  keywords: [
    'ArchDraw docs',
    'architecture diagram tool documentation',
    'MCP server guide',
    'system design tool guide',
  ],
  openGraph: {
    type: 'website',
    url: 'https://archdraw.app/docs',
    title: 'ArchDraw Documentation',
    description:
      'Getting started, node types, MCP server setup, prompt guide, API reference, and more.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Documentation' }],
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
