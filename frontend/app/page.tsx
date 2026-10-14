import type { Metadata } from 'next';
import LiveLanding from '@/components/landing/live/LiveLanding';

export const metadata: Metadata = {
  title: 'ArchDraw | A live map of your codebase for Claude Code',
  description:
    'See every Claude Code session on a live architecture map of your codebase: where each one is working, what it is changing, and which one needs you. One command, no account.',
  keywords: [
    'Claude Code',
    'parallel coding agents',
    'Claude Code sessions',
    'live architecture map',
    'codebase map',
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
    title: 'Six agents are coding. Which one needs you?',
    description:
      'ArchDraw puts every Claude Code session on a live map of your codebase. One command, no account.',
    siteName: 'ArchDraw',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw system architecture diagram tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Six agents are coding. Which one needs you?',
    description:
      'ArchDraw puts every Claude Code session on a live map of your codebase. One command, no account.',
    images: ['/api/og/home'],
  },
};

export default function LandingPage() {
  return <LiveLanding />;
}
