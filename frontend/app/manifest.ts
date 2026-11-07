import type { MetadataRoute } from 'next';
import { BRAND_COLORS } from '@/lib/site/brand';

/** Web app manifest: name, colours and the brand mark for install prompts and home screens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ArchDraw — System Architecture Diagrams',
    short_name: 'ArchDraw',
    description:
      'A live architecture map of your codebase for Claude Code, plus AI-assisted system architecture diagrams from a prompt, Mermaid or a GitHub repo.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: BRAND_COLORS.nightPage,
    theme_color: BRAND_COLORS.nightPage,
    categories: ['developer', 'productivity', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
