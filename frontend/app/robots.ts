import type { MetadataRoute } from 'next';

const DISALLOWED = ['/editor', '/api', '/share', '/auth'];

const ALLOWED = ['/', '/docs', '/blogs', '/tutorials', '/tutorials/*', '/learn/*'];

const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'Applebot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: ALLOWED,
        disallow: DISALLOWED,
      })),
      {
        userAgent: '*',
        allow: ALLOWED,
        disallow: DISALLOWED,
      },
    ],
    sitemap: 'https://archdraw.app/sitemap.xml',
  };
}
