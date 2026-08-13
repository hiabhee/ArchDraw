import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design Tutorials — Learn Architecture | ArchDraw',
  description:
    'Interactive tutorials to learn system design by building real architectures from scratch. Netflix, Instagram, ChatGPT, Uber, and more.',
  keywords:
    'system design tutorial, architecture diagram tutorial, learn system design, system design interview prep',
};

export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
